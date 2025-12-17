// server/sockets/gameSocket.js
import redisClient from '../config/redis.js';
import { users } from '../config/mongoCollections.js';
import bcrypt from 'bcryptjs';

const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS_PER_ROOM = 4;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const WORDS = ['APPLE', 'BANANA', 'CHERRY', 'GRAPE', 'MANGO'];

const rooms = new Map();
const MAX_ROUNDS = 3;


const leaderboardKey = (roomCode) => `leaderboard:${roomCode}`;

// prefer Auth0 sub; fallback keeps game from exploding if something is missing
const getStableUserId = (socket, payloadUserId) => {
  return payloadUserId || socket?.data?.userId || socket.id;
};

const ensurePlayerInLeaderboard = async (roomCode, userId, userName) => {
  const key = leaderboardKey(roomCode);

  const exists = await redisClient.hExists(key, userId);
  if (!exists) {
    const defaultStats = { user: userName, roundWins: 0, matchWins: 0 };
    await redisClient.hSet(key, userId, JSON.stringify(defaultStats));
  } else {
    // keep username fresh in case it changes
    const raw = await redisClient.hGet(key, userId);
    if (raw) {
      const stats = JSON.parse(raw);
      stats.user = userName;
      await redisClient.hSet(key, userId, JSON.stringify(stats));
    }
  }
};

const addRoundWin = async (roomCode, userId) => {
  const key = leaderboardKey(roomCode);
  const raw = await redisClient.hGet(key, userId);
  if (!raw) return;

  const stats = JSON.parse(raw);
  stats.roundWins = (stats.roundWins || 0) + 1;

  await redisClient.hSet(key, userId, JSON.stringify(stats));
};

const addMatchWin = async (roomCode, userId) => {
  const key = leaderboardKey(roomCode);
  const raw = await redisClient.hGet(key, userId);
  if (!raw) return;

  const stats = JSON.parse(raw);
  stats.matchWins = (stats.matchWins || 0) + 1;

  await redisClient.hSet(key, userId, JSON.stringify(stats));
};

const getLeaderboard = async (roomCode) => {
  const key = leaderboardKey(roomCode);
  const data = await redisClient.hGetAll(key);

  return Object.entries(data).map(([userId, raw]) => {
    const stats = JSON.parse(raw);
    return { userId, ...stats };
  });
};

/* =========================
   Mongo updates (per match)
   ========================= */

// increment Mongo immediately after each match ends
const persistMatchDeltasToMongo = async (matchStatsByUserId, userNameByUserId) => {
  const userIds = Object.keys(matchStatsByUserId || {});
  if (userIds.length === 0) return;

  const usersCollection = await users();

  const ops = userIds.map((auth0Sub) => {
    const s = matchStatsByUserId[auth0Sub] || { roundWins: 0, matchWins: 0 };

    const incRound = Number(s.roundWins) || 0;
    const incMatch = Number(s.matchWins) || 0;

    // if a player somehow has 0/0, skip them
    if (incRound === 0 && incMatch === 0) return null;

    const userName = userNameByUserId[auth0Sub] || 'Unknown';

    return {
      updateOne: {
        filter: { auth0Sub },
        update: {
          $inc: { roundWins: incRound, matchWins: incMatch },
          $set: { userName },
          $setOnInsert: { auth0Sub },
        },
        upsert: true,
      },
    };
  }).filter(Boolean);

  if (ops.length === 0) return;

  try {
    await usersCollection.bulkWrite(ops, { ordered: false });
    console.log(`✓ Persisted match stats to Mongo for ${ops.length} players`);
  } catch (e) {
    console.error('Error persisting to Mongo:', e);
    throw e; // Re-throw so caller knows it failed
  }
};

/* =========================
   Existing scoreboard helpers
   ========================= */

const buildScoreboard = (room) => {
  const entries = Object.entries(room.scores || {}).map(([playerId, s]) => {
    const wins = s.wins || 0;
    const totalTime = s.totalTime || 0;

    return {
      playerId,
      name: s.name || 'Unknown',
      wins,
      totalTime,
      avgTime: wins > 0 ? totalTime / wins : null,
    };
  });

  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;

    if (a.avgTime === null && b.avgTime === null) return a.name.localeCompare(b.name);
    if (a.avgTime === null) return 1;
    if (b.avgTime === null) return -1;

    if (a.avgTime !== b.avgTime) return a.avgTime - b.avgTime;
    return a.name.localeCompare(b.name);
  });

  return entries;
};

const safeCallback = (cb, payload) => {
  if (typeof cb === 'function') cb(payload);
};

const pickRandomWord = () => {
  const i = Math.floor(Math.random() * WORDS.length);
  return WORDS[i];
};

const createRoomCode = () => {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
};

const createUniqueRoomCode = () => {
  let code = createRoomCode();
  while (rooms.has(code)) code = createRoomCode();
  return code;
};

const normalizeName = (name, fallback) => {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  return trimmed.length ? trimmed : fallback;
};


// sends the latest room state to everyone in the room so all clients stay in sync
const broadcastRoomUpdate = (io, roomCode) => {
  const room = rooms.get(roomCode);
  if (!room) return;

  io.to(roomCode).emit('roomUpdate', {
    roomCode,
    hostId: room.hostId,
    players: room.players,
    gameStarted: !!room.gameStarted,
    round: room.round || 0,
    // if round is undefined for some reason, we show 0 so clients do not render "undefined"
  });
};

const removePlayerFromRoom = (roomCode, socketId) => {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players = room.players.filter((player) => player.id !== socketId);

  if (room.hostId === socketId && room.players.length > 0) {
    room.hostId = room.players[0].id;
  }

  // if room empties, delete it after a short delay
  if (room.players.length === 0) {
    setTimeout(async () => {
      const r = rooms.get(roomCode);
      if (r && r.players.length === 0) {
        try {
          // just cleanup redis – mongo was already updated after each match
          await redisClient.del(leaderboardKey(roomCode));
          console.log(`✓ Cleaned up empty room: ${roomCode}`);
        } catch (e) {
          console.log('Error cleaning up redis leaderboard:', e);
        }

        rooms.delete(roomCode);
      }
    }, 5000);
  }
};

const initGameSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // CREATE ROOM
    socket.on('createRoom', async ({ hostName, playerId } = {}, callback) => {
      const roomCode = createUniqueRoomCode();
      const playerName = normalizeName(hostName, 'Host');

      // store auth0 sub + name on socket
      socket.data.userId = playerId || null;
      socket.data.playerName = playerName;
      socket.data.roomCode = roomCode;

      const player = { id: socket.id, name: playerName };

      rooms.set(roomCode, {
        hostId: socket.id,
        players: [player],
        gameStarted: false,
        round: 0,
        roundActive: false,
        maxRounds: MAX_ROUNDS,
        currentWord: null,
        currentHints: null,

        // in-memory match scoreboard (per match)
        scores: {},

        // map socket.id -> auth0Sub for winner calc
        userIdBySocketId: {},

        // map auth0Sub -> display name
        userNameByUserId: {},

        // per-match deltas to persist to mongo at gameOver
        matchDeltasByUserId: {},
      });

      const room = rooms.get(roomCode);

      // init match scoreboard for this socket
      room.scores[socket.id] = { name: playerName, wins: 0, totalTime: 0 };

      // store mappings
      const stableUserId = getStableUserId(socket, playerId);
      room.userIdBySocketId[socket.id] = stableUserId;
      room.userNameByUserId[stableUserId] = playerName;

      socket.join(roomCode);

      // Redis: ensure player exists in room leaderboard
      try {
        await ensurePlayerInLeaderboard(roomCode, stableUserId, playerName);
      } catch (e) {
        console.log('Redis ensure host failed:', e);
      }

      safeCallback(callback, {
        success: true,
        roomCode,
        players: room.players,
        hostId: room.hostId,
        gameStarted: !!room.gameStarted,
        round: room.round || 0,
      });

      broadcastRoomUpdate(io, roomCode);
    });

    // JOIN ROOM
    socket.on('joinRoom', async ({ roomCode, playerName, playerId } = {}, callback) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      if (!code || !room) {
        safeCallback(callback, { success: false, message: 'Room not found.' });
        return;
      }

      if (room.gameStarted) {
        safeCallback(callback, { success: false, message: 'Game already started.' });
        return;
      }

      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        safeCallback(callback, { success: false, message: 'Room is full.' });
        return;
      }

      const name = normalizeName(playerName, 'Player');

      // store auth0 sub + name on socket
      if (room.players.some(p => p.id === socket.id)) {
        safeCallback(callback, {
            success: true,
            roomCode: code,
            players: room.players,
            hostId: room.hostId,
            gameStarted: !!room.gameStarted,
            round: room.round || 0,
        });
        return;
      }
      socket.data.userId = playerId || null;
      socket.data.playerName = name;
      socket.data.roomCode = code;

      const player = { id: socket.id, name };
      room.players.push(player);

      if (!room.scores[socket.id]) {
        room.scores[socket.id] = { name, wins: 0, totalTime: 0 };
      }

      // store mappings
      const stableUserId = getStableUserId(socket, playerId);
      room.userIdBySocketId[socket.id] = stableUserId;
      room.userNameByUserId[stableUserId] = name;

      socket.join(code);

      // Redis: ensure player exists
      try {
        await ensurePlayerInLeaderboard(code, stableUserId, name);

        const leaderboard = await getLeaderboard(code);
        io.to(code).emit('leaderboardUpdate', leaderboard);
      } catch (e) {
        console.log('Redis leaderboard update failed:', e);
      }

      safeCallback(callback, {
        success: true,
        roomCode: code,
        players: room.players,
        hostId: room.hostId,
        gameStarted: !!room.gameStarted,
        round: room.round || 0,
      });

      broadcastRoomUpdate(io, code);
    });

    // LEAVE ROOM
    socket.on('leaveRoom', ({ roomCode } = {}, callback) => {
      const code = roomCode?.toUpperCase() || socket.data.roomCode;

      if (!code || !rooms.has(code)) {
        safeCallback(callback, { success: false, message: 'Room not found.' });
        return;
      }

      removePlayerFromRoom(code, socket.id);
      socket.leave(code);

      if (socket.data.roomCode === code) {
        delete socket.data.roomCode;
      }

      safeCallback(callback, { success: true });
      broadcastRoomUpdate(io, code);
    });

    // START GAME (host only)
    socket.on('startGame', async ({ roomCode } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      if (!room) {
        safeCallback(cb, { success: false, message: 'Room not found.' });
        return;
      }

      if (room.hostId !== socket.id) {
        safeCallback(cb, { success: false, message: 'Only host can start.' });
        return;
      }

      // reset match deltas at start of each match
      room.matchDeltasByUserId = {};
      for (const player of room.players) {
        const uid = room.userIdBySocketId[player.id];
        if (!uid) continue;
        room.matchDeltasByUserId[uid] = { roundWins: 0, matchWins: 0 };
      }

      // reset per-match scores
      for (const player of room.players) {
        room.scores[player.id] = { 
          name: player.name, 
          wins: 0, 
          totalTime: 0 
        };
      }

      room.gameStarted = true;
      room.round = 1; // previously deleted line
      room.roomActive = false; // waiting on data 

      console.log(`Game started in room ${code}, word: ${room.currentWord}`);

      broadcastRoomUpdate(io, code);

      // separate event so clients can run game-specific logic immediately
      io.to(code).emit('gameStarted', { 
        roomCode: code,
        round: room.round, // previously deleted line
        maxRounds: room.maxRounds || MAX_ROUNDS,
      });

      safeCallback(cb, { success: true });
    });

    // host provides new round data (word + hints)
    socket.on('newRoundData', ({ roomCode, word, hints } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      if (!room) {
        safeCallback(cb, { success: false, message: 'Room not found.' });
        return;
      }

      if (room.hostId !== socket.id) {
        safeCallback(cb, { success: false, message: 'Only host can send round data.' });
        return;
      }

      room.currentWord = word;
      room.currentHints = hints;
      room.roundActive = true;

      io.to(code).emit('roundData', {
        word,
        hints,
        round: room.round,
      });

      safeCallback(cb, { success: true });
    });

    // SUBMIT GUESS
    socket.on('submitGuess', async ({ roomCode, guess, elapsedTime } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      if (!room || !room.gameStarted || !room.currentWord) {
        safeCallback(cb, { success: false, correct: false, message: 'Game not started.' });
        return;
      }

      const cleanGuess = (guess || '').toUpperCase();
      // correct approach for finding correct guess; expected target word will be hashed
      const isCorrect = await bcrypt.compare(cleanGuess, room.currentWord);


      // playerName is saved on the socket when they join/create the room
      const playerName = socket.data?.playerName || 'Unknown';

      io.to(code).emit('guessPosted', {
        roomCode: code,
        playerId: socket.id,
        playerName,
        guess: cleanGuess,
        correct: isCorrect,
        elapsedTime: elapsedTime ?? null,
        timestamp: Date.now(),
      });

      if (!isCorrect) {
        safeCallback(cb, { success: true, correct: false });
        return;
      }

      // CORRECT GUESS - update all scoreboards
      const timeUsed = Number.isFinite(elapsedTime) ? elapsedTime : null;

      // 1. Update in-memory match scoreboard
      if (!room.scores[socket.id]) {
        room.scores[socket.id] = { name: playerName, wins: 0, totalTime: 0 };
      }
      room.scores[socket.id].wins += 1;
      if (timeUsed !== null) room.scores[socket.id].totalTime += timeUsed;

      // 2. Get stable user ID
      const stableUserId = room.userIdBySocketId[socket.id] || getStableUserId(socket);
      room.userNameByUserId[stableUserId] = playerName;

      // 3. Track per-match delta for mongo (will be persisted at game end)
      if (!room.matchDeltasByUserId[stableUserId]) {
        room.matchDeltasByUserId[stableUserId] = { roundWins: 0, matchWins: 0 };
      }
      room.matchDeltasByUserId[stableUserId].roundWins += 1;

      // 4. Update Redis room leaderboard immediately
      try {
        await ensurePlayerInLeaderboard(code, stableUserId, playerName);
        await addRoundWin(code, stableUserId);

        const leaderboard = await getLeaderboard(code);
        io.to(code).emit('leaderboardUpdate', leaderboard);
      } catch (e) {
        console.error('Redis update failed:', e);
      }

      // check if round is over and pass as a param
      let isGameOver;
      const maxRounds = room.maxRounds || MAX_ROUNDS;
      if (room.round >= maxRounds) {
        isGameOver = true;
      } else {
        isGameOver = false;
      }

      // 5. Broadcast round result
      io.to(code).emit('roundResult', {
        roomCode: code,
        correct: true,
        round: room.round,
        playerId: socket.id,
        playerName,
        guess: cleanGuess,
        elapsedTime: timeUsed,
        isGameOver: isGameOver
      });


      // CHECK IF MATCH IS OVER
      if (room.round >= maxRounds) {
        const scoreboard = buildScoreboard(room);
        room.gameStarted = false;
        room.currentWord = null;
        room.roundActive = false;

        // Determine match winner(s) based on THIS MATCH's round wins
        const deltas = room.matchDeltasByUserId || {};
        let bestRoundWins = -Infinity;
        for (const uid of Object.keys(deltas)) {
          const rw = deltas[uid]?.roundWins || 0;
          if (rw > bestRoundWins) bestRoundWins = rw;
        }
        const winnerUserIds = Object.keys(deltas).filter(
          (uid) => (deltas[uid]?.roundWins || 0) === bestRoundWins
        );

        // Winners get +1 matchWins in both delta tracking and Redis
        for (const uid of winnerUserIds) {
          if (!room.matchDeltasByUserId[uid]) {
            room.matchDeltasByUserId[uid] = { roundWins: 0, matchWins: 0 };
          }
          room.matchDeltasByUserId[uid].matchWins += 1;

          try {
            await ensurePlayerInLeaderboard(code, uid, room.userNameByUserId[uid] || 'Unknown');
            await addMatchWin(code, uid);
          } catch (e) {
            console.error('Redis match win update failed:', e);
          }
        }

        // CRITICAL: Persist all match deltas to MongoDB
        try {
          await persistMatchDeltasToMongo(room.matchDeltasByUserId, room.userNameByUserId);
        } catch (e) {
          console.error('CRITICAL: Failed to persist match stats to MongoDB:', e);
        }

        // Get final leaderboards
        let roomLeaderboard = null;
        try {
          roomLeaderboard = await getLeaderboard(code);
          io.to(code).emit('leaderboardUpdate', roomLeaderboard);
        } catch (e) {
          console.error('Final leaderboard fetch failed:', e);
        }

        // Broadcast game over
        io.to(code).emit('gameOver', {
          roomCode: code,
          maxRounds,
          scoreboard,
          leaderboard: roomLeaderboard,
        });

        safeCallback(cb, { success: true, correct: true, gameOver: true });
        return;
      }

      // NEXT ROUND
      room.round += 1;
      room.roundActive = false;

      broadcastRoomUpdate(io, code);

      safeCallback(cb, { success: true, correct: true, gameOver: false });
    });

    // host provides new rounds data (word + hints) since only they will call the Gemini API
    socket.on('newRoundData', ({ roomCode, word, hints } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      if (!room) {
        safeCallback(cb, { success: false, message: 'Room not found.' });
        return;
      }

      // enforce host-only authority
      if (room.hostId !== socket.id) {
        safeCallback(cb, { success: false, message: 'Only host can send round data.' });
        return;
      }

      // store authoritative round data on server
      room.currentWord = word;
      room.currentHints = hints;

      // broadcast to all players (including host)
      io.to(code).emit('roundData', {
        word,
        hints,
        round: room.round
      });

      safeCallback(cb, { success: true });
    });

    // sends the current leaderboard back to a client so the results page can load on refresh
    socket.on('fetchResults', async ({ roomCode } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      if (!room) {
        safeCallback(cb, { success: false, message: 'Room not found.' });
        return;
      }

      const scoreboard = buildScoreboard(room);

      let leaderboard = null;
      try {
        leaderboard = await getLeaderboard(code);
      } catch (e) {
        console.error('Fetch leaderboard error:', e);
      }

      safeCallback(cb, {
        success: true,
        roomCode: code,
        scoreboard,
        leaderboard,
        round: room.round || 0,
      });
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      const { roomCode } = socket.data || {};
      if (!roomCode) return;

      console.log(`Socket ${socket.id} disconnected from room ${roomCode}`);
      removePlayerFromRoom(roomCode, socket.id);
      broadcastRoomUpdate(io, roomCode);
    });
  });
};

export default initGameSocket;
