import { Link } from 'react-router-dom'
import '../styles/App.css';

function Navigation() {
  return (
    <nav className="navbar">
      <div className="nav-content">
        <h1 className="nav-logo">Word Game</h1>

        <div className="nav-links">
          <Link to="/profile">Profile</Link>
          <Link to="/lobby">Lobby</Link>
          <Link to="/leaderboard">Leaderboard</Link>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;