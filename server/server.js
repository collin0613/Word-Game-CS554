// server/server.js (Resolved)
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors'
import initgamesocket from './sockets/gameSocket.js';
import constructorMethod from './routes/index.js';
import { connectRedis } from './config/redis.js';
await connectRedis();

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
constructorMethod(app);

// check if server is running
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpserver = http.createServer(app);
const io = new Server(httpserver, {
  cors: {
    origin: process.env.client_origin || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

//export default redisclient; 

initgamesocket(io); 

const port = process.env.port || 4000;
httpserver.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
}); 
