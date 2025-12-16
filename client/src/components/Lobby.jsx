import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactModal from 'react-modal';
import { useAuth0 } from '@auth0/auth0-react';
import { useSocket } from '../services/SocketContext.jsx';
import '../styles/App.css';

ReactModal.setAppElement('#root');

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: '50%',
    border: '5px solid #28547a',
    borderRadius: '4px',
    backgroundColor: 'rgb(122, 115, 103)',
  },
};

// landing screen after login where you create or join a room
function Lobby() {
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [joinRoomError, setJoinRoomError] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const navigate = useNavigate();
  const { socket, status } = useSocket();
  const { user, isAuthenticated, isLoading } = useAuth0();

  // consistent player name logic (same as GameRoom)
  const playerName = useMemo(() => {
    if (!user) return '';
    return (
      user.nickname ||
      user.name ||
      user.email?.split('@')[0] ||
      'PlayerFrontend'
    );
  }, [user]);

  if (isLoading) return <p>Loading profile…</p>;
  if (!isAuthenticated) return <p>Please log in first.</p>;

  // CREATE ROOM
  const handleCreateRoom = () => {
    if (!socket || status !== 'connected') {
      setErrorMessage('Connecting to server…');
      return;
    }

    socket.emit('createRoom', { hostName: playerName }, (res) => {
      if (!res?.success) {
        setErrorMessage(res?.message || 'Could not create room');
        return;
      }

      setErrorMessage('');
      navigate(`/game/${res.roomCode}`);
    });
  };

  // keep room codes clean: A–Z only, uppercase
  const handleRoomCodeInput = (input) => {
    const upper = input.toUpperCase();
    if (/^[A-Z]*$/.test(upper)) {
      setRoomCodeInput(upper);
    }
  };

  // JOIN ROOM
  const handleJoinRoom = (roomCode) => {
    if (!socket || status !== 'connected') {
      setErrorMessage('Connecting to server…');
      setJoinRoomError(true);
      return;
    }

    socket.emit('joinRoom', { roomCode, playerName }, (res) => {
      if (!res?.success) {
        setJoinRoomError(true);
        setErrorMessage(res?.message || `Could not join room "${roomCode}"`);
        return;
      }

      // success
      setJoinRoomError(false);
      setErrorMessage('');
      setShowJoinRoomModal(false);
      setRoomCodeInput('');

      navigate(`/game/${res.roomCode}`);
    });
  };

  return (
    <div className="lobby">
      <h1 className="title">Word Game Lobby</h1>

      {/* non-join errors (create room / connection issues) */}
      {errorMessage && !joinRoomError && (
        <p className="error-box">{errorMessage}</p>
      )}

      <div className="btn-list">
        <button onClick={handleCreateRoom}>Create Room</button>
        <button onClick={() => setShowJoinRoomModal(true)}>Join Room</button>
      </div>

      <ReactModal
        style={customStyles}
        isOpen={showJoinRoomModal}
        onRequestClose={() => setShowJoinRoomModal(false)}
      >
        <h3>Join Room</h3>
        <p>Enter a four-letter room code:</p>

        <input
          value={roomCodeInput}
          maxLength={4}
          onChange={(e) => handleRoomCodeInput(e.target.value)}
        />

        {joinRoomError && (
          <div className="error-box">{errorMessage}</div>
        )}

        <button
          className="btn"
          disabled={roomCodeInput.length !== 4}
          onClick={() => handleJoinRoom(roomCodeInput)}
        >
          Join
        </button>

        <button
          className="btn"
          onClick={() => {
            setShowJoinRoomModal(false);
            setJoinRoomError(false);
            setErrorMessage('');
            setRoomCodeInput('');
          }}
        >
          Back
        </button>
      </ReactModal>
    </div>
  );
}

export default Lobby;
