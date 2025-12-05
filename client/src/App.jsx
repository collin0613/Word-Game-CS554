import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Profile from './pages/Profile.jsx';
import Navigation from './components/Navigation.jsx'
import Leaderboard from './components/Leaderboard.jsx';
//import GameRoom from './pages/GameRoom.jsx';
import Lobby from './components/Lobby.jsx';

// TODO: 
// App.jsx should contain all our <Routes> like done in labs

function App() {
  return (
    <div>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path='/leaderboard' element={<Leaderboard />} />
        {/* <Route path="/game/:id" element={<GameRoom />} /> */}

        {/* <Route path="/login" element={<Login />} />   No Login route necessary; the component is rendered in Home.jsx, and login/signup buttons route to Auth0's pages.   */}
        <Route path="*" element={<p>404 Not Found</p>} />
      </Routes>
    </div>
  );
}

export default App;
