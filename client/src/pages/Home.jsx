import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Home = () => {
  // Source code given from the website
  const {
    isLoading, // Loading state, the SDK needs to reach Auth0 on load
    isAuthenticated,
    error,
    loginWithRedirect: login, // Starts the login flow
    logout: auth0Logout, // Starts the logout flow
    user, // User profile
  } = useAuth0();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate])

  const signup = () => login({ authorizationParams: { screen_hint: "signup" } });
 
  const logout = () => auth0Logout({ logoutParams: { returnTo: window.location.origin } });

  if (isLoading) return "Loading...";

  return (
    <div className="home">
      <h2>Word Game</h2>
      <p>
        Face off against users. Race to guess a word first. Get points for faster times and climb the leaderboard.
      </p>
      <p>
        Most importantly: have fun!
      </p>
      <div className="login-components">
        {!isAuthenticated && (
          <>
            {error && <p>Error: {error.message}</p>}

            <button className='signup-button' onClick={signup}>Signup</button>

            <button className='login-button' onClick={login}>Login</button>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;