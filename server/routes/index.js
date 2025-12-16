import llmRoutes from './llmRoutes.js';

const constructorMethod = (app) => {
  app.use('/api', llmRoutes);
  app.use('*', (req, res) => {
    res.status(404).json({error: 'Route Not found'});
  });
};

export default constructorMethod;
