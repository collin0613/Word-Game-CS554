import redis from 'redis';
import express from 'express';
import configRoutes from './routes/index.js';
const app = express();
const redisClient = redis.createClient();

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
connectRedis();

app.use(express.json());

configRoutes(app);

app.listen(3000, async () => {
  await redisClient.connect();
  console.log("We've now got a server!");
  console.log('Your routes will be running on http://localhost:3000');
});

export default redisClient;