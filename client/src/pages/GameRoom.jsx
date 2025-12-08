import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Game from '../components/Game';

function GameRoom() {
    const navigate = useNavigate();
    const navBack = () => {
        navigate('/lobby')
    }
    const [gameStarted, setGameStarted] = useState(false);

    const handleStartGame = () => {
        setGameStarted(true);
        // TODO: when game is live, new players are unable to join
    }


    return (
        <>
            {!gameStarted ? 
                <><p> Welcome to the game room.</p>
                    {/* 
                    TODO: Display player count: x/4 players joined.
                    When at least 2 players have connected, display the "Start Game" button. When a game is started, players can no longer connect to that game. 
                    */}
                    <button className="start-game-button" onClick={() => handleStartGame()}>Start Game</button></>
            : 
                <Game />
            }
            <button className="back-button" onClick={() => navBack()}>Back to Lobby</button>
        </>
    );
}

export default GameRoom;