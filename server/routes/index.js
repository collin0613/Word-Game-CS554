// import authRoutes from './authRoutes.js';
// import gameRoutes from './gameRoutes.js';

const constructorMethod = (app) => {
  // app.use('/games', gameRoutes);
  // app.use('/auth', authRoutes);

  app.use('*', (req, res) => {
    res.status(404).json({error: 'Route Not found'});
  });
};

export default constructorMethod;