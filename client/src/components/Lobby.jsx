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

// this is the landing screen after login where you either create a room or join one
function Lobby() {
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [joinRoomError, setJoinRoomError] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const navigate = useNavigate();
  const { socket, status } = useSocket();
  const { user, isAuthenticated, isLoading } = useAuth0();

  // figures out a friendly display name from the auth profile, same as in gamroom
  // this keeps the game working even if some profile fields are missing
  const playerName = useMemo(() => {
    if (!user) return '';
    return (
      user.nickname ||
      user.name ||
      user.email?.split('@')[0] ||
      'PlayerFrontend'
    );
  }, [user]);

  const playerId = useMemo(() => {
    if (!user) return '';
    return user.sub || '';
  }, [user]);


  if (isLoading) return <p>Loading profile…</p>;

  // do not allow lobby actions unless logged in
  if (!isAuthenticated) return <p>Please log in first.</p>;

  // creates a room on the server and immediately navigates to the room page
  const handleCreateRoom = () => {
    // the socket might still be connecting when the user clicks, so we guard this
    if (!socket || status !== 'connected') {
      setErrorMessage('Connecting...');
      return;
    }

    socket.emit('createRoom', { hostName: playerName, playerId }, (res) => {
      // if something fails server side, show the message instead of silently doing nothing
      if (!res?.success) {
        setErrorMessage(res?.message || 'Could not create room');
        return;
      }

      // server returns the actual room code, so we trust that and route to it
      navigate(`/game/${res.roomCode}`);
    });
  };

  // keeps room codes clean and consistent by allowing only letters and forcing uppercase
  const handleRoomCodeInput = (input) => {
    const allowedPattern = /^[A-Z]*$/;

    // this blocks numbers, spaces, and symbols so users cannot type invalid codes
    if (allowedPattern.test(input.toUpperCase())) {
      setRoomCodeInput(input.toUpperCase());
    }
  };

  // attempts to join a room and routes to the room page if it works
  const handleJoinRoom = (roomCode) => {
    // same guard as create, because users will click fast
    if (!socket || status !== 'connected') {
      setErrorMessage('Connecting...');
      setJoinRoomError(true);
      return;
    }

    socket.emit('joinRoom', { roomCode, playerName, playerId }, (res) => {
      // if the room does not exist or is full, show the server message in the modal
      if (!res?.success) {
        setJoinRoomError(true);
        setErrorMessage(res?.message || `Could not join room "${roomCode}"`);
        return;
      }

      // clear errors and close the modal so the next open starts fresh
      setJoinRoomError(false);
      setErrorMessage('');
      setShowJoinRoomModal(false);

      // navigate using the server returned code (it will be uppercase and validated)
      navigate(`/game/${res.roomCode}`);
    });
  };

  return (
    <div className="lobby">
      <h1 className="title">Word Game Lobby</h1>

      {/* this is for non join errors, like create room issues or socket connecting */}
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

        {/* join errors show inside the modal so the user can fix the code right there */}
        {joinRoomError && <div className="error-box">{errorMessage}</div>}

        <button
          className="btn"
          // room codes are 4 letters, so we keep the button disabled until it is complete
          disabled={roomCodeInput.length !== 4}
          onClick={() => handleJoinRoom(roomCodeInput)}
        >
          Join
        </button>

        <button className="btn" onClick={() => setShowJoinRoomModal(false)}>
          Back
        </button>
      </ReactModal>
    </div>
  );
}

export default Lobby;
