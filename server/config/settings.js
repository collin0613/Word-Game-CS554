//YOU WILL NEED TO CHANGE THE DB NAME TO MATCH THE REQUIRED DB NAME IN THE ASSIGNMENT SPECS!!!

let connectionString = process.env.MONGO_URI;
if (!connectionString) {
  connectionString = 'mongodb://localhost:27017/Word-Game-CS554';
}
export const mongoConfig = {
    connectionString: connectionString,
};
