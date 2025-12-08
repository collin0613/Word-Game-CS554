import React, {useState, useEffect} from 'react';
import Timer from '../components/Timer';
//import HintBox from './HintBox';
import bcrypt from 'bcryptjs';
import { useNavigate } from 'react-router-dom';

function Game() {
    const [isRunning, setIsRunning] = useState(true); // timer
    const [resetSignal, setResetSignal] = useState(0);
    const [roundCount, setRoundCount] = useState(1);
    const [guessInput, setGuessInput] = useState('');
    const [targetWord, setTargetWord] = useState("APPLE");  // targetWord will be hashed when received from backend function
    const [message, setMessage] = useState('');
    const [displayMessage, setDisplayMesssage] = useState(false);
    const [countdown, setCountdown] = useState(null); 
    const [roundOver, setRoundOver] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const navigate = useNavigate();
    const navResults = () => {
        navigate('/gane/:id/results'); // change to the actual game id eventually
    }

    // TODO: backend function generateTargetWord
    // targetWord will be received from backend function which generates word through Gemini API call. 
    // In this backend function, capitalize the targetWord with toUpperCase() (since guessInput will always be full capital letters), 
    // and then it should be encrypted with bcrypt. --> await bcrypt.hash(targetWord.toUpperCase(), 10);
    //      (Without encryption, players could look in the console debugger and find the value for targetWord)

    const allowedPattern = /^[A-Z]*$/; // regex pattern for allowing only capital letters
    const handleGuessInput = (input) => {
        if (allowedPattern.test((input).toUpperCase())) {
            setGuessInput(input.toUpperCase());
        }
    }

    const handleGuess = async (guess, target) => {
        setGuessInput('');
        const hash = await bcrypt.hash(target, 10); // temporary: targetWord received from backend will already be encrypted
        let result = await bcrypt.compare(guess, hash);
        if (result) {
            handleCorrectGuess("Player1", guess);
        } else {
            console.log(`Player incorretly guessed: ${guess}`)
            setMessage('Incorrect.');
            setDisplayMesssage(true);
        }
    }   

    const handleCorrectGuess = (player, guess) => { 
        setIsRunning(false);  
        setRoundOver(true);
        setCountdown(5);

        console.log(`Player correctly guessed the word ${guess} after ${elapsedTime} seconds`);

        setMessage(
            `Player ${player} correctly guessed the word "${guess}" after ${elapsedTime} seconds.`
        );
        
        setDisplayMesssage(true);
    };

    const startNewRound = async () => {
        // receive new word from calling backend function
        setMessage('');
        setDisplayMesssage(false);
        setTargetWord("BANANA"); // temp
        setRoundCount(prev => prev + 1);
        setResetSignal(prev => prev + 1);  // triggers timer reset
        setIsRunning(true);                // start running
    };



    useEffect(() => {
        if (countdown === null) return;

        if (countdown === 0) {
            setCountdown(null);
            startNewRound();
            return;
        }

        const timer = setTimeout(() => {
            setCountdown(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);


    return (
        <>
            <p>Round {roundCount}</p>
            <div>
            <Timer
                isRunning={isRunning}
                resetSignal={resetSignal}
                onTick={(seconds) => setElapsedTime(seconds)}
            />


            {/* TODO: HintBox renders here once implemented */}

            <label className="input-label">Guess the Word: </label>
            <input className="guess-input" value={guessInput} onChange={(input) => handleGuessInput((input.target.value))} />
            <button onClick={() => handleGuess(guessInput, targetWord)}>Submit Guess</button>
            {displayMessage && <p>{message}</p>}

            {countdown !== null && (
            <p className="countdown-text">
                Round {roundCount + 1} begins in: {countdown}...
            </p>
            )}

            {(roundOver && roundCount === 7) && navResults()}
            </div>
        </>
    );

}

export default Game;