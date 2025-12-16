import React, { useState, useEffect, useRef, useCallback } from 'react';
import Timer from '../components/Timer';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../services/SocketContext.jsx';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import HintBox from './HintBox.jsx';

// this is the main gameplay screen for a room
// it shows the timer, lets players submit guesses, and renders a live feed of all guesses
function Game({ roomCode, playerName, hostId }) {
  const [isRunning, setIsRunning] = useState(false);
  const [roundReady, setRoundReady] = useState(false);
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

  const [targetWord, setTargetWord] = useState(null);
  const [allHints, setAllHints] = useState([]);
  const [hintIndex, setHintIndex] = useState(0);
  const hasFetchedRoundDataRef = useRef(false);

  const { socket, status } = useSocket();
  const navigate = useNavigate();

  // only allow letters so guesses look clean and match how the server compares words
  // also allows spaces between words
  const allowedPattern = /^[A-Z ]*$/;

  // keeps the input uppercase and blocks any characters we do not want to accept
  const handleGuessInput = (input) => {
    const upper = (input || '').toUpperCase();
    const sanitized = upper.replace(/[^A-Z ]/g, '');
    setGuessInput(sanitized);
  };

  // shows the winner message and pauses the round so everyone sees the result
  const showRoundWinner = useCallback((winnerName, guess, timeUsed) => {
    setIsRunning(false);
    setRoundOver(true);
    setCountdown(5);

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

    setRoundCount((prev) => prev + 1);
    setResetSignal((prev) => prev + 1);
    setRoundReady(false);

    setHintIndex(0);
    setAllHints([]);
    setTargetWord(null);
    hasFetchedRoundDataRef.current = false;

    setIsRunning(false);
    setRoundOver(false);
  }, []);

  // host only fetches new word and hints from the server and emits to all clients
  const requestNewRound = async () => {
    if (!socket || socket.id !== hostId) return;
    if (hasFetchedRoundDataRef.current) return;

    hasFetchedRoundDataRef.current = true;

    try {
      const { data } = await axios.get('http://localhost:4000/api');

      socket.emit(
        'newRoundData',
        {
          roomCode,
          word: data.word,
          hints: data.hints,
        },
        (res) => {
          if (!res?.success) {
            console.warn(res?.message);
          }
        }
      );
    } catch (err) {
      console.error('Failed to fetch round data:', err);
    }
  };

  // triggers first round
  useEffect(() => {
    if (!socket || status !== 'connected') return;
    if (!hostId) return;
    if (socket.id !== hostId) return;

    requestNewRound();
  }, [status, hostId]);

  // all clients receive authoritative round data
  useEffect(() => {
    if (!socket) return;

    const handleRoundData = ({ word, hints }) => {
      setTargetWord(word);
      setAllHints(hints);
      setHintIndex(0);
      setRoundReady(true);
      setIsRunning(true);
    };

    socket.on('roundData', handleRoundData);
    return () => socket.off('roundData', handleRoundData);
  }, [socket]);

  // displays hints based on the hintIndex state
  useEffect(() => {
    if (!allHints.length) return;

    const t1 = setTimeout(() => setHintIndex(1), 10000);
    const t2 = setTimeout(() => setHintIndex(2), 20000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [allHints]);

  // sends the guess to the server
  const handleGuess = () => {
    const guess = guessInput.trim().toUpperCase();
    if (!guess) return;

    if (!socket || status !== 'connected' || !roomCode) return;

    const timeUsed = elapsedTime;
    setGuessInput('');

    socket.emit(
      'submitGuess',
      { roomCode, guess, elapsedTime: timeUsed },
      (res) => {
        if (!res?.success) {
          console.error('Guess submission failed:', res?.message);
        }
      }
    );
  };

  // listens for every guess
  useEffect(() => {
    if (!socket) return;

    const handleGuessPosted = (data) => {
      setGuesses((prev) => [...prev, data]);
    };

    socket.on('guessPosted', handleGuessPosted);
    return () => socket.off('guessPosted', handleGuessPosted);
  }, [socket]);

  // listens for round winner
  useEffect(() => {
    if (!socket) return;

    const handleRoundResult = (data) => {
      if (!data?.correct) return;
      showRoundWinner(data.playerName, data.guess, data.elapsedTime);
    };

    socket.on('roundResult', handleRoundResult);
    return () => socket.off('roundResult', handleRoundResult);
  }, [socket, showRoundWinner]);

  // game over
  useEffect(() => {
    if (!socket) return;

    const handleGameOver = (data) => {
      navigate(`/game/${roomCode}/results`, {
        state: { scoreboard: data?.scoreboard || [] },
      });
    };

    socket.on('gameOver', handleGameOver);
    return () => socket.off('gameOver', handleGameOver);
  }, [socket, navigate, roomCode]);

  // countdown between rounds
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      startNewRound();
      if (socket && socket.id === hostId) requestNewRound();
      return;
    }

    const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, startNewRound, socket, hostId]);

  // auto-scroll guesses
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  const isOwnGuess = (g) => socket && g.playerId === socket.id;
  const visibleHints = allHints.slice(0, hintIndex + 1);

  return !roundReady ? (
    <div>
      <p className="loading-text">Preparing next round…</p>
    </div>
  ) : (
    <>
      <p>Game room {roomCode}</p>
      <p>Round {roundCount}</p>

      <Timer
        isRunning={isRunning && roundReady}
        resetSignal={resetSignal}
        onTick={(seconds) => setElapsedTime(seconds)}
      />

      <HintBox visibleHints={visibleHints} />

      <label className="input-label">Guess the Word:</label>
      <input
        className="guess-input"
        value={guessInput}
        onChange={(e) => handleGuessInput(e.target.value)}
        disabled={roundOver || !roundReady}
      />

      <button
        onClick={handleGuess}
        disabled={roundOver || !guessInput || !roundReady}
      >
        Submit Guess
      </button>

      {showBanner && <p>{bannerMessage}</p>}

      {countdown !== null && (
        <p className="countdown-text">
          Next round begins in {countdown}...
        </p>
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
    </>
  );
}

export default Game;
