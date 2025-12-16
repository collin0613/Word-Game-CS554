// server/server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors'
import initgamesocket from './sockets/gameSocket.js';
import constructorMethod from './routes/index.js';
import { connectRedis } from './config/redis.js';
await connectRedis();

const app = express();

app.use(express.json());

// check if server is runnin
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

initgamesocket(io); 

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
