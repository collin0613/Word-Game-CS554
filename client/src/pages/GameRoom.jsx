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

  // room codes are stored uppercase on the server
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
    if (!isAuthenticated) return;
    if (!socket || status !== 'connected' || !roomCode || !playerName) return;

    const handleRoomUpdate = ({ players, hostId, gameStarted }) => {
      setPlayers(players || []);
      setHostId(hostId || null);
      if (gameStarted) setGameStarted(true);
    };

    const handleGameStarted = () => {
      setGameStarted(true);
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('gameStarted', handleGameStarted);

    // join room (important for direct URL access)
    socket.emit('joinRoom', { roomCode, playerName }, (res) => {
      if (res?.success) {
        setPlayers(res.players || []);
        setHostId(res.hostId || null);
        if (res.gameStarted) setGameStarted(true);
      }
    });

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('gameStarted', handleGameStarted);
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
          <p>Welcome to the game room.</p>
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
