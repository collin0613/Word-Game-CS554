import React, { useState, useEffect, useRef, useCallback } from 'react';
import Timer from '../components/Timer';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../services/SocketContext.jsx';

// this is the main gameplay screen for a room
// it shows the timer, lets players submit guesses, and renders a live feed of all guesses
function Game({ roomCode, playerName }) {
  const [isRunning, setIsRunning] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [roundCount, setRoundCount] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [guessInput, setGuessInput] = useState('');
  const [bannerMessage, setBannerMessage] = useState('');
  const [showBanner, setShowBanner] = useState(false);

  const [countdown, setCountdown] = useState(null);
  const [roundOver, setRoundOver] = useState(false);

  const [guesses, setGuesses] = useState([]);
  const chatEndRef = useRef(null);

  const { socket, status } = useSocket();
  const navigate = useNavigate();

  // only allow letters so guesses look clean and match how the server compares words
  const allowedPattern = /^[A-Z]*$/;

  // keeps the input uppercase and blocks any characters we do not want to accept
  const handleGuessInput = (input) => {
    const upper = (input || '').toUpperCase();
    if (allowedPattern.test(upper)) setGuessInput(upper);
  };

  // shows the winner message and pauses the round so everyone sees the result
  const showRoundWinner = useCallback((winnerName, guess, timeUsed) => {
    setIsRunning(false);
    setRoundOver(true);
    setCountdown(5);

    // if the client did not send a valid time, show a question mark instead of crashing the message
    const timeText =
      timeUsed === null || timeUsed === undefined ? '?' : String(timeUsed);

    setBannerMessage(
      `Player ${winnerName} correctly guessed "${guess}" in ${timeText} seconds.`
    );
    setShowBanner(true);
  }, []);

  // resets round ui and restarts the timer so the next round feels clean
  const startNewRound = useCallback(() => {
    setBannerMessage('');
    setShowBanner(false);

    // use the callback form so we never depend on a stale state value
    setRoundCount((prev) => prev + 1);
    setResetSignal((prev) => prev + 1);

    setIsRunning(true);
    setRoundOver(false);
  }, []);

  // sends the guess to the server and clears the input locally right away
  const handleGuess = () => {
    const guess = guessInput.trim().toUpperCase();

    // do not spam empty guesses
    if (!guess) return;

    // if the socket is not ready, just bail  
    if (!socket || status !== 'connected' || !roomCode) {
      console.warn('Not connected; cannot submit guess.');
      return;
    }

    const timeUsed = elapsedTime;

    // clear the input immediately so the ui feels responsive
    setGuessInput('');

    socket.emit(
      'submitGuess',
      { roomCode, guess, elapsedTime: timeUsed },
      (res) => {
        // the server sends an ack so we can log issues without relying on extra events
        if (!res?.success) {
          console.error('Guess submission failed:', res?.message);
        }
      }
    );
  };

  // listens for every guess so we can render the live feed
  useEffect(() => {
    // if the socket is not available yet, do nothing
    if (!socket) return;

    const handleGuessPosted = (data) => {
      // append to the end so the feed stays in order
      setGuesses((prev) => [...prev, data]);
    };

    socket.on('guessPosted', handleGuessPosted);

    // cleanup matters because this component can remount during navigation
    return () => socket.off('guessPosted', handleGuessPosted);
  }, [socket]);

  // listens for the official round winner event and shows the banner for everyone
  useEffect(() => {
    if (!socket) return;

    const handleRoundResult = (data) => {
      // ignore anything that is not a correct result
      if (!data?.correct) return;

      showRoundWinner(data.playerName, data.guess, data.elapsedTime);
    };

    socket.on('roundResult', handleRoundResult);
    return () => socket.off('roundResult', handleRoundResult);
  }, [socket, showRoundWinner]);

  // when the server says the game is over, send everyone to the results page
  useEffect(() => {
    if (!socket) return;

    const handleGameOver = (data) => {
      // pass scoreboard through route state so results can render instantly
      navigate(`/game/${roomCode}/results`, {
        state: { scoreboard: data?.scoreboard || [] },
      });
    };

    socket.on('gameOver', handleGameOver);
    return () => socket.off('gameOver', handleGameOver);
  }, [socket, navigate, roomCode]);

  // runs the between round countdown and then triggers the next round when it hits zero
  useEffect(() => {
    // countdown is null when no countdown is active
    if (countdown === null) return;

    // once we hit zero, we reset and start the new round
    if (countdown === 0) {
      setCountdown(null);
      startNewRound();
      return;
    }

    const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, startNewRound]);

  // keeps the guess feed scrolled to the newest entry
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  // used for styling your own guesses differently
  const isOwnGuess = (g) => socket && g.playerId && g.playerId === socket.id;

  return (
    <>
      <p>Game room {roomCode}</p>
      <p>Round {roundCount}</p>

      <div>
        <Timer
          isRunning={isRunning}
          resetSignal={resetSignal}
          onTick={(seconds) => setElapsedTime(seconds)}
        />

        <label className="input-label">Guess the Word: </label>
        <input
          className="guess-input"
          value={guessInput}
          onChange={(e) => handleGuessInput(e.target.value)}
          //freeze input when round is over cuz tristan said we need to wait for api or something
          disabled={roundOver}
        />

        <button onClick={handleGuess} disabled={roundOver || !guessInput}>
          Submit Guess
        </button>

        {showBanner && <p>{bannerMessage}</p>}

        {countdown !== null && (
          <p className="countdown-text">Next round begins in {countdown}...</p>
        )}

        <div className="guess-chat-container">
          <h3>Guesses</h3>
          <div className="guess-chat-list">
            {guesses.map((g, idx) => (
              <div
                key={g.timestamp || idx}
                className={`guess-line ${
                  g.correct ? 'guess-correct' : 'guess-incorrect'
                } ${isOwnGuess(g) ? 'guess-own' : ''}`}
              >
                <strong>{g.playerName}:</strong> {g.guess}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </>
  );
}

export default Game;
