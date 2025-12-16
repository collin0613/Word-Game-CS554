import llmRoutes from './llmRoutes.js';
import leaderboardRoutes from './leaderboardRoutes.js';

const constructorMethod = (app) => {
  app.use('/api', llmRoutes);
  app.use('/leaderboard', leaderboardRoutes);
  app.use('*', (req, res) => {
    res.status(404).json({error: 'Route Not found'});
  });
};

export default constructorMethod;