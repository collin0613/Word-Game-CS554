import bcrypt from 'bcryptjs';

const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS_PER_ROOM = 4;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Simple word list for now; we will replace this with Gemini or whatever API later
const WORDS = ['APPLE', 'BANANA', 'CHERRY', 'GRAPE', 'MANGO'];

const rooms = new Map();
const MAX_ROUNDS = 3;

// builds a sorted leaderboard from the room scores so the frontend can render results easily
const buildScoreboard = (room) => {
  // if scores is missing for some reason, fall back to an empty object so Object.entries does not crash
  const entries = Object.entries(room.scores || {}).map(([playerId, s]) => {
    // if any field is missing, we treat it as zero so math and sorting behave predictably
    const wins = s.wins || 0;
    const totalTime = s.totalTime || 0;

    // avgTime is only meaningful if you have at least 1 win, otherwise we leave it null
    const avgTime = wins > 0 ? totalTime / wins : null;

    return {
      playerId,
      name: s.name || 'Player',
      wins,
      totalTime,
      avgTime,
    };
  });

  // leaderbord sorting by wins , then avgTime, then totalTime asc
  entries.sort((a, b) => {
    // first priority is who won more rounds
    if (b.wins !== a.wins) return b.wins - a.wins;

    // players with zero wins have avgTime = null, so we push them to the bottom for this comparison
    const aAvg = a.avgTime ?? Number.POSITIVE_INFINITY;
    const bAvg = b.avgTime ?? Number.POSITIVE_INFINITY;

    // if wins are tied, the faster average round wins
    if (aAvg !== bAvg) return aAvg - bAvg;

    // final tie breaker is totalTime, mainly to keep ordering stable
    return a.totalTime - b.totalTime;
  });

  return entries;
};

// safely runs a socket callback only if the client actually provided one
const safeCallback = (cb, payload) => {
  // socket.io acks are optional, so this prevents "cb is not a function" errors
  if (typeof cb === 'function') cb(payload);
};

// generates a random 4 letter room code like abcd
const generateRoomCode = () => {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    // picks one random character for each position in the code
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
};

// keeps generating codes until it finds one that is not already used
const createUniqueRoomCode = () => {
  let code = generateRoomCode();

  // extremely unlikely to collide, but this makes it guaranteed unique while the server is running
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  return code;
};

// cleans up a name string and uses the fallback if the input is missing or empty
const normalizeName = (name, fallback) => {
  // if the client sends something weird like null or a number, just use the fallback
  if (typeof name !== 'string') return fallback;

  const trimmed = name.trim();

  // if it was just spaces, also use the fallback
  return trimmed.length ? trimmed : fallback;
};


// sends the latest room state to everyone in the room so all clients stay in sync
const broadcastRoomUpdate = (io, roomCode) => {
  const room = rooms.get(roomCode);

  // if the room was deleted (or never existed), do nothing instead of throwing
  if (!room) return;

  io.to(roomCode).emit('roomUpdate', {
    roomCode,
    players: room.players,
    hostId: room.hostId,
    gameStarted: !!room.gameStarted,
    // if round is undefined for some reason, we show 0 so clients do not render "undefined"
    round: room.round
  });
};

// removes a player from the room and handles host reassignment and room cleanup
const removePlayerFromRoom = (roomCode, socketId) => {
  const room = rooms.get(roomCode);

  // if the room does not exist, there is nothing to clean up
  if (!room) return;

  // remove the player entry for this socket id
  room.players = room.players.filter((player) => player.id !== socketId);

  // if the host leaves, move host to the first remaining player so the room can keep functioning
  if (room.hostId === socketId && room.players.length > 0) {
    room.hostId = room.players[0].id;
  }

  // if everyone left, delete the room after a short delay
  // this helps prevent accidental room deletion on quick refreshes or brief disconnects
  if (room.players.length === 0) {
    setTimeout(() => {
      const r = rooms.get(roomCode);

      // we re-check in case someone rejoined during the grace period
      if (r && r.players.length === 0) {
        rooms.delete(roomCode);
      }
    }, 5000);
  }
};

// sets up all socket events for rooms and gameplay
const initGameSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // CREATE ROOM
    socket.on('createRoom', ({ hostName } = {}, callback) => {
      const roomCode = createUniqueRoomCode();
      const playerName = normalizeName(hostName, 'Host');
      const player = { id: socket.id, name: playerName };

      console.log('Created room:', roomCode);
      console.log('Host player:', player);

      // create the room record and initialize game state
      rooms.set(roomCode, {
        hostId: socket.id,
        players: [player],
        gameStarted: false,
        round: null,
        roundActive: false, // new addition: round is not active until the axios api call is done processing and socket.emitting data
        maxRounds: MAX_ROUNDS,
        currentWord: null,
        scores: {},
      });

      const room = rooms.get(roomCode);

      // initialize host score so results page always has a row for the host
      room.scores[socket.id] = {
        name: playerName,
        wins: 0,
        totalTime: 0,
      };

      // join the socket.io room so broadcasts can be done with io.to(roomCode)
      socket.join(roomCode);

      // store quick access data on the socket for later events (guesses, disconnects, etc.)
      socket.data.roomCode = roomCode;
      socket.data.playerName = playerName;

      safeCallback(callback, {
        success: true,
        roomCode,
        players: room.players,
        hostId: room.hostId,
        gameStarted: false,
        round: 0,
      });

      // broadcast so the host UI updates immediately
      broadcastRoomUpdate(io, roomCode);
    });

    // JOIN ROOM
    socket.on('joinRoom', ({ roomCode, playerName } = {}, callback) => {
      // normalize to uppercase so "abcd" and "ABCD" map to the same room
      const code = roomCode?.toUpperCase();

      console.log('Join request for:', roomCode, '->', code);
      console.log('Existing rooms:', [...rooms.keys()]);

      const room = code ? rooms.get(code) : null;

      // if no code was provided or no matching room exists, fail cleanly
      if (!code || !room) {
        safeCallback(callback, { success: false, message: 'Room not found.' });
        return;
      }

      // enforce max player count to keep the UI and game logic simple
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        safeCallback(callback, { success: false, message: 'Room is full.' });
        return;
      }

      const name = normalizeName(playerName, 'Player');
      console.log('Player joining:', name);

      // prevent adding the same socket twice (can happen from double submits or reconnects)
      const alreadyInRoom = room.players.some((p) => p.id === socket.id);
      if (!alreadyInRoom) {
        room.players.push({ id: socket.id, name });
      }

      // ensure every player has a scoreboard entry even if they never win a round
      if (!room.scores[socket.id]) {
        room.scores[socket.id] = {
          name,
          wins: 0,
          totalTime: 0,
        };
      }

      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerName = name;

      safeCallback(callback, {
        success: true,
        roomCode: code,
        players: room.players,
        hostId: room.hostId,
        gameStarted: !!room.gameStarted,
        round: room.round || 0,
      });

      // broadcast so every client updates the player list and host label
      broadcastRoomUpdate(io, code);
    });

    // LEAVE ROOM
    socket.on('leaveRoom', ({ roomCode } = {}, callback) => {
      // allow either explicit roomCode or fallback to whatever the socket last joined
      const code = roomCode?.toUpperCase() || socket.data.roomCode;

      // if the room is missing, the client might be out of sync, so return a clean failure
      if (!code || !rooms.has(code)) {
        safeCallback(callback, { success: false, message: 'Room not found.' });
        return;
      }

      removePlayerFromRoom(code, socket.id);
      socket.leave(code);

      // clear socket cached data if it was pointing to this room
      if (socket.data.roomCode === code) {
        delete socket.data.roomCode;
        delete socket.data.playerName;
      }

      safeCallback(callback, { success: true });

      // broadcast updated room state so remaining users see the correct roster
      broadcastRoomUpdate(io, code);
    });

    // START GAME (host only)
    socket.on('startGame', ({ roomCode } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      // do not start if the room cannot be found
      if (!room) {
        safeCallback(cb, { success: false, message: 'Room not found.' });
        return;
      }

      // only host can start so random players cannot force the game state
      if (room.hostId !== socket.id) {
        safeCallback(cb, { success: false, message: 'Only host can start.' });
        return;
      }

      // initialize game state for round 1
      room.gameStarted = true;
      room.round = 1; // previously deleted line
      room.roomActive = false; // waiting on data 

      console.log(`Game started in room ${code}, word: ${room.currentWord}`);

      // send room state update so UIs switch from lobby view to game view
      broadcastRoomUpdate(io, code);

      // separate event so clients can run game-specific logic immediately
      io.to(code).emit('gameStarted', { 
        roomCode: code,
        round: room.round, // previously deleted line
        maxRounds: room.maxRounds || MAX_ROUNDS,
      });

      safeCallback(cb, { success: true });
    });

    // SUBMIT GUESS (shared game logic and chat)
    socket.on('submitGuess', async ({ roomCode, guess, elapsedTime } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      // reject guesses if the room is missing or the game is not active
      if (!room || !room.gameStarted || !room.currentWord) {
        safeCallback(cb, {
          success: false,
          correct: false,
          message: 'Game not started.',
        });
        return;
      }

      // normalize input so comparison is case-insensitive and consistent
      const cleanGuess = (guess || '').toUpperCase();
      // correct approach for finding correct guess; expected target word will be hashed
      const isCorrect = await bcrypt.compare(cleanGuess, room.currentWord);


      // playerName is saved on the socket when they join/create the room
      const playerName = socket.data?.playerName || 'Unknown';

      // broadcast every guess so everyone sees the running feed
      io.to(code).emit('guessPosted', {
        roomCode: code,
        playerId: socket.id,
        playerName,
        guess: cleanGuess,
        correct: isCorrect,
        // keep null instead of undefined so the frontend can check it reliably
        elapsedTime: elapsedTime ?? null,
        timestamp: Date.now(),
      });

      if (isCorrect) {
        // only accept elapsedTime if it is a real number
        // this protects scoring if the client sends something invalid
        const timeUsed = Number.isFinite(elapsedTime) ? elapsedTime : null;

        // score entry should exist, but this ensures we never crash if it does not
        if (!room.scores[socket.id]) {
          room.scores[socket.id] = { name: playerName, wins: 0, totalTime: 0 };
        }

        // a correct guess means this player wins the round
        room.scores[socket.id].wins += 1;

        // totalTime is used for tie breakers and avg time, so only add if we have a valid time
        if (timeUsed !== null) room.scores[socket.id].totalTime += timeUsed;

        // tell everyone who won the round so they can show the banner and pause inputs
        io.to(code).emit('roundResult', {
          roomCode: code,
          correct: true,
          round: room.round,
          playerId: socket.id,
          playerName,
          guess: cleanGuess,
          elapsedTime: timeUsed,
        });

        const maxRounds = room.maxRounds || MAX_ROUNDS;

        // if we just finished the last round, end the game and broadcast final results
        if (room.round >= maxRounds) {
          const scoreboard = buildScoreboard(room);

          // mark the game as ended so further guesses are rejected cleanly
          room.gameStarted = false;

          // remove the active word so nobody can keep guessing after game end
          room.currentWord = null;

          // broadcast results to everyone so the frontend can navigate to results page
          io.to(code).emit('gameOver', {
            roomCode: code,
            maxRounds,
            scoreboard,
          });

          safeCallback(cb, { success: true, correct: true, gameOver: true });
          return;
        }

        // otherwise move to the next round and pick a new word
        // the frontend countdown is just a UI delay; the server state moves immediately
        room.round += 1;

        // broadcast updated round number so clients stay consistent
        // word + hints will be provided by host via newRoundData
        broadcastRoomUpdate(io, code);

        safeCallback(cb, { success: true, correct: true, gameOver: false });
      } else {
        // incorrect guess does not change room state, it only updates the guess feed
        safeCallback(cb, { success: true, correct: false });
      }
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
    socket.on('fetchResults', ({ roomCode } = {}, cb) => {
      const code = roomCode?.toUpperCase();
      const room = code ? rooms.get(code) : null;

      // if the room does not exist, results cannot be returned
      if (!room) {
        safeCallback(cb, { success: false, message: 'Room not found.' });
        return;
      }

      const scoreboard = buildScoreboard(room);

      safeCallback(cb, {
        success: true,
        roomCode: code,
        scoreboard,
        // returning round is useful for debugging and optional UI display
        round: room.round || 0,
      });
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      const { roomCode } = socket.data || {};

      // if the socket was never in a room, there is nothing to clean up
      if (!roomCode) return;

      removePlayerFromRoom(roomCode, socket.id);
      broadcastRoomUpdate(io, roomCode);
    });
  });
};

export default initGameSocket;
