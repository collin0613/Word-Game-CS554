import { useState, useEffect, useRef } from "react";

function Timer({ isRunning, onTick, resetSignal }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsElapsed(prev => {
          const updated = prev + 1;
          if (onTick) onTick(updated);
          return updated;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  useEffect(() => {
    setSecondsElapsed(0);
  }, [resetSignal]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="timer-display">
      <h2>{formatTime(secondsElapsed)}</h2>
    </div>
  );
}

export default Timer;
