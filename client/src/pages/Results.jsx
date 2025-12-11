import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../services/SocketContext.jsx';

// takes a value that should represent seconds and formats it nicely for the table
function formatSeconds(x) {
  // if we do not have a real number, show a dash so the ui stays clean
  if (x === null || x === undefined) return '-';

  const n = Number(x);

  // if the value cannot be converted into a usable number, also show a dash
  if (!Number.isFinite(n)) return '-';

  // two decimals looks good for timer style numbers
  return n.toFixed(2);
}

// shows the final leaderboard after the game ends
// it tries to render instantly from route state, but can also refetch from the server on refresh
function Results() {
  const { id } = useParams();

  // room codes are stored in uppercase on the server so we normalize here too
  const roomCode = (id || '').toUpperCase();

  const navigate = useNavigate();
  const location = useLocation();
  const { socket, status } = useSocket();

  // if we navigated here from the game screen, scoreboard is usually already in route state
  // on a full refresh, route state is gone, so we start with an empty array and fetch
  const [scoreboard, setScoreboard] = useState(location.state?.scoreboard || []);

  const [error, setError] = useState('');

  // if the page is refreshed, we lose the passed in scoreboard, so we ask the server for it again
  useEffect(() => {
    // if we already have results, do not fetch again
    if (scoreboard.length > 0) return;

    // if the socket is not ready, we cannot request results yet
    if (!socket || status !== 'connected' || !roomCode) return;

    socket.emit('fetchResults', { roomCode }, (res) => {
      // if the server says the room is missing, show a friendly message instead of a blank page
      if (!res?.success) {
        setError(res?.message || 'Failed to load results.');
        return;
      }

      // store the results locally so the table renders
      setScoreboard(res.scoreboard || []);
    });
  }, [socket, status, roomCode, scoreboard.length]);

  // the scoreboard is sorted on the server, so the first row should be the winner
  const winner = useMemo(() => {
    if (!scoreboard.length) return null;
    return scoreboard[0];
  }, [scoreboard]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2>Results</h2>

      <p>
        Room: <strong>{roomCode}</strong>
      </p>

      {winner && (
        <p>
          Winner: <strong>{winner.name}</strong> (wins: {winner.wins})
        </p>
      )}

      {/* error only shows when the server cannot return results */}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Player</th>
            <th align="right">Wins</th>
            <th align="right">Total Time (s)</th>
            <th align="right">Avg Time / Win (s)</th>
          </tr>
        </thead>

        <tbody>
          {scoreboard.map((p) => (
            <tr key={p.playerId}>
              <td>{p.name}</td>
              <td align="right">{p.wins}</td>
              <td align="right">{formatSeconds(p.totalTime)}</td>
              <td align="right">
                {p.avgTime == null ? '-' : formatSeconds(p.avgTime)}
              </td>
            </tr>
          ))}

          {/* show a simple loading state while we are waiting for fetchResults */}
          {!scoreboard.length && !error && (
            <tr>
              <td colSpan={4}>Loading…</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => navigate('/lobby')}>Back to Lobby</button>
      </div>
    </div>
  );
}

export default Results;
