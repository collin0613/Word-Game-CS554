// server/server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import initGameSocket from './sockets/gameSocket.js';

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

initGameSocket(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
