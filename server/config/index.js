import authDataFunctions from './auth0.js';
import geminiDataFunctions from './gemini.js';
import redisDataFunctions from './redis.js'; // maybe not necessary?

export const authData = authDataFunctions;
export const geminiData = geminiDataFunctions;
export const redisData = redisDataFunctions; // maybe not necessary?