import { useNavigate } from "react-router-dom";
// import { gameConfigData } from "../../../server/services/index.js";
import ReactModal from 'react-modal';
import React, { useState } from "react";
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';

ReactModal.setAppElement('#root'); // this was in lecture/lab7 code, is it necessary?
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
    backgroundColor: 'rgb(122, 115, 103)'
  }
};

function Lobby() {
    const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [errorMessage, setErrorMessage] = useState(''); // displayed on joinRoomModal if incorrect/nonexistent room code is submitted
    const [joinRoomError, setJoinRoomError] = useState(false); // boolean determines to display error message or not
    const [roomCodeInput, setRoomCodeInput] = useState(''); // input text on the modal

    const navigate = useNavigate(); 

    const handleCreateRoom = () => {
        // TODO: create createRoom function in server/services/gameConfig.js
        
        // then call the function: 
        // const newRoom = await gameConfigData.createRoom(user);
        //    --> in createRoom function, create random room code (GENERATE A RANDOM 4 LETTER CODE LIKE JACKBOX)
        //    --> Implement using websockets, look at slides from the lecture, 
        //        you can easily create a 'room' and probably set its _id to the jackbox-like room code generated

        // const id = newRoom.id;
        // navigate(`/game/${id}`)

        navigate(`/game/:id`);  // delete this once above has been implemented, this is just for testing purposes
    }

    const closeJoinRoomModal = () => {
        setRoomCodeInput('');
        setShowJoinRoomModal(false);
    };

    /* 
    Jackbox-style room code input implementation:
        -->  cannot even type in anything other than letters (auto-capitalize), as input will not update
        -->  the submit button is disabled until your input is four letters,
        -->  you are unable to type in any more than four letters
    */
    const allowedPattern = /^[A-Z]*$/; // regex pattern for allowing only capital letters
    const handleRoomCodeInput = (input) => {
        if (allowedPattern.test((input).toUpperCase())) {
            setRoomCodeInput(input.toUpperCase());
        }
    }

    const handleJoinRoom = () => {
    // TODO: create joinRoom function in server/services/gameConfig.js, which calls function to join a room/
    // It will determine if room code exists, if so then joins the lobby by routing to '/game/:id'

    // NOTE: we cannot just attempt to route to '/game/:id' and see if it exists, since that will be
    //       the route for creating a new room with that random ID. we can check if we can connect to a
    //       websocket room by that id, if fails, catch and render the error ON THE MODAL and erase input

        try {
            // call the gameConfig fucntion and process its output
            // if no errors are caught from gameConfigData.joinRoom(roomCode), then continue on route to that room

            // const joinRoom = await gameConfigData.joinRoom(roomCode);
            // setJoinRoomError(false); 
            // setErrorMessage('');
            // setShowJoinRoomModal(false);
            // navigate('/game/${roomCode}');       

            navigate('/game/:id'); // delete this once above has been implemented, this is just for testing purposes 
        } catch(e) {
            // if we catch error, render an error message ON THE MODAL
            setJoinRoomError(true);
            setErrorMessage(e.message || `Could not join room with code "${roomCode}"`);
            setRoomCodeInput('');
        }

    }

    const openJoinRoomModal = () => {
        setShowJoinRoomModal(true);
    }

    return (
        <div className="lobby">
            <h1 className='title'>Word Game Lobby</h1>
            <ul className="btn-list">
                <br />
                <button onClick={(handleCreateRoom)}>Create Room</button>
                <br />
                <br />
                <button onClick={(openJoinRoomModal)}>Join Room</button>
                <br />

                <ReactModal style={customStyles} isOpen={showJoinRoomModal} onRequestClose={(() => setShowJoinRoomModal(false))}>
                    <h3>Join Room</h3>
                    <p>Enter a four-letter room code:</p>
                    <input value={roomCodeInput} maxLength={4} onChange={(input) => handleRoomCodeInput(input.target.value)} />
                    <br />
                    {joinRoomError && <Alert variant="danger">{errorMessage}</Alert>} 
                    <br />
                    <button className='btn' type='submit'/* <-- maybe not even necessary? */ disabled={roomCodeInput.length !== 4} onClick={() => { setRoomCode(roomCodeInput); handleJoinRoom(); }}>Join</button>
                    <button className='btn' onClick={() => closeJoinRoomModal()}>Back</button>
                </ReactModal>
                
                <br />
            </ul>
        </div>
    );
}

export default Lobby;