import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';
import { io } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';

// 1)
const SocketContext = createContext(null);

// 2a) Provider: owns the socket and its lifecycle
// 2b) Ensures only one socket exists and manages its connection status
export const SocketProvider = ({ children }) => {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('disconnected'); 
  // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    // Loading Check
    if (isLoading) return;

    // If NOT authenticated -> make sure no socket is alive
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setStatus('disconnected');
      setError(null);
      return;
    }

    // Fall through -> IS Authenticated -> Create the socket
    let isCancelled = false;
    let newSocket;

    const connectSocket = async () => {
      try {
        setStatus('connecting');

        // Get Auth0 access token to send with the socket handshake
        const token = await getAccessTokenSilently();

        if (isCancelled) return;

        newSocket = io('http://localhost:4000', {
          auth: {
            token
          }
          // you can add options like transports, withCredentials, etc. later
        });

        newSocket.on('connect', () => {
          if (isCancelled) return;
          setStatus('connected');
          setError(null);
          console.log('Socket connected:', newSocket.id);
        });

        newSocket.on('disconnect', (reason) => {
          if (isCancelled) return;
          setStatus('disconnected');
          console.log('Socket disconnected:', reason);
        });

        newSocket.on('connect_error', (err) => {
          if (isCancelled) return;
          console.error('Socket connect error:', err);
          setStatus('error');
          setError(err);
        });

        setSocket(newSocket);
      } catch (err) {
        if (isCancelled) return;
        console.error('Error getting token or connecting socket:', err);
        setStatus('error');
        setError(err);
      }
    };

    connectSocket();

    // Cleanup if auth state changes or component unmounts
    return () => {
      isCancelled = true;
      if (newSocket) {
        newSocket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        status,
        error
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// 3). If the consumer needs to use the socket:
export const useSocket = () => useContext(SocketContext);
