import React, { useEffect, useState } from 'react';
import '../styles/App.css';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError('');

      // Backend has route registered at /leaderboard (see routes/index.js)
      const response = await fetch('http://localhost:4000/leaderboard');

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard (${response.status})`);
      }

      const data = await response.json();
      setLeaderboard(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="leaderboard">
        <h1>Global Leaderboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard">
        <h1>Global Leaderboard</h1>
        <p style={{ color: 'crimson' }}>{error}</p>
        <button onClick={fetchLeaderboard}>Retry</button>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <h1>Global Leaderboard</h1>

      {leaderboard.length === 0 ? (
        <p>No players yet. Be the first to play!</p>
      ) : (
        <table style={{ width: '100%', maxWidth: 720, margin: '0 auto', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Rank</th>
              <th align="left">Player</th>
              <th align="right">Match Wins</th>
              <th align="right">Round Wins</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, index) => (
              <tr key={player.userName + index}>
                <td>{index + 1}</td>
                <td>{player.userName}</td>
                <td align="right">{player.matchWins}</td>
                <td align="right">{player.roundWins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={fetchLeaderboard}>Refresh</button>
      </div>
    </div>
  );
}

export default Leaderboard;
