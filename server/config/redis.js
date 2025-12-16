// server/config/redis.js
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("error", (err) => {
  console.log("Redis Error:", err);
});

export const connectRedis = async () => {
  // connect once
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected");
  }
  return redisClient;
};

export default redisClient;
