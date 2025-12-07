import redis from 'redis';
import express from 'express';
import configRoutes from './routes/index.js';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const redisClient = redis.createClient();

const httpServer = http.createServer(app);

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
connectRedis();

app.use(express.json());

configRoutes(app);

app.listen(3000, async () => {
  console.log("We've now got a server!");
  console.log('Your routes will be running on http://localhost:3000');
});

export default redisClient;