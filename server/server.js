// server/server.js (Resolved)
import express from 'express';
import http from 'http';
import { server } from 'socket.io';
import initgamesocket from './sockets/gamesocket.js';

const app = express();

app.use(express.json());

// check if server is runnin
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpserver = http.createserver(app);
const io = new server(httpserver, {
  cors: {
    origin: process.env.client_origin || 'http://localhost:5173',
    methods: ['get', 'post'],
  },
});

export default redisclient; 

initgamesocket(io); 

const port = process.env.port || 4000;
httpserver.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
}); 
