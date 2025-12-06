import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function GameRoom() {
    const navigate = useNavigate();
    const navBack = () => {
        navigate('/lobby')
    }
    return (
        <>
            <p> Welcome to the game room.</p>
            <button className="back-button" onClick={() => navBack()}>Back to Lobby</button>
        </>
    );
}

export default GameRoom;