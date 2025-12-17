import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../services/SocketContext.jsx';
import { useAuth0 } from '@auth0/auth0-react';
import Game from '../components/Game';

// this page is the "room wrapper" that handles joining the room and showing the lobby view
// once the host starts the game, it swaps to the actual <Game /> component
function GameRoom() {
  const navigate = useNavigate();
  const { id } = useParams();

  // room codes are stored uppercase on the server, so we normalize here for consistency
  const roomCode = id?.toUpperCase() || '';

  const { socket, status } = useSocket();
  const { user, isAuthenticated, isLoading } = useAuth0();

  // pull a reasonable player name from auth
  const playerName = useMemo(() => {
    if (!user) return '';
    return (
      user.nickname ||
      user.name ||
      user.email?.split('@')[0] ||
      'PlayerFrontend'
    );
  }, [user]);

  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // if the user is not logged in, we cannot join a room
    if (!isAuthenticated) return;

    // wait until the socket is connected and we have the data we need
    if (!socket || status !== 'connected' || !roomCode || !playerName) return;

    // updates the room lobby ui whenever the server broadcasts new room state
    const handleRoomUpdate = ({ players, hostId, gameStarted }) => {
      setPlayers(players || []);
      setHostId(hostId || null);

      // once the server says the game started, keep it started locally
      if (gameStarted) setGameStarted(true);
    };

    // this is a direct "gameStarted" event so the ui switches immediately
    const handleGameStarted = () => {
      setGameStarted(true);
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('gameStarted', handleGameStarted);

    // joining here is important because users can land on this route directly via url
    socket.emit('joinRoom', { roomCode, playerName }, (res) => {
      // if join fails (room missing, room full), you could add a redirect here later
      if (res?.success) {
        setPlayers(res.players || []);
        setHostId(res.hostId || null);

        // if the game already started before this user joined, we should jump straight into game view
        if (res.gameStarted) setGameStarted(true);
      }
    });

    return () => {
      // remove listeners so we do not duplicate handlers on remount
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('gameStarted', handleGameStarted);

      // tell the server we are leaving so it can update the player list and host if needed
      socket.emit('leaveRoom', { roomCode });
    };
  }, [socket, status, roomCode, playerName, isAuthenticated, isLoading]);

  // host is whoever matches the hostId
  const isHost = hostId && socket && socket.id === hostId;

  // host-only action to start the game
  const handleStartGame = () => {
    if (!socket || status !== 'connected') return;
    if (!isHost) return;

    socket.emit('startGame', { roomCode }, (res) => {
      if (res?.success) {
        setGameStarted(true);
      }
    });
  };

  const navBack = () => navigate('/lobby');

  // auth guards
  if (isLoading) return <p>Loading profile…</p>;
  if (!isAuthenticated) return <p>Please log in first.</p>;

  return (
    <>
      {!gameStarted ? (
        <div>
          <p className="text-4xl">Welcome to the game room.</p>
          <p>
            Room Code: <strong>{roomCode}</strong>
          </p>

          <p>Players ({players.length}/4)</p>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                {p.name} {p.id === hostId ? '(Host)' : ''}
              </li>
            ))}
          </ul>

          {isHost ? (
            <button
              disabled={players.length < 2}
              className="start-game-button"
              onClick={handleStartGame}
            >
              Start Game
            </button>
          ) : (
            <p>Waiting for the host to start the game…</p>
          )}
        </div>
      ) : (
        <Game
          roomCode={roomCode}
          playerName={playerName}
          hostId={hostId}
        />
      )}

      <button className="back-button" onClick={navBack}>
        Back to Lobby
      </button>
    </>
  );
}

export default GameRoom;
