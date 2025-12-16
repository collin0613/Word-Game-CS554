// Express app setup

// is this file needed if server.js sets up express + redis?

import express from 'express';
const app = express();
import cookieParser from 'cookie-parser';
import configRoutes from './routes/index.js';
import middleware from './middleware.js';
import session from 'express-session';

const rewriteUnsupportedBrowserMethods = (req, res, next) => {
     // If the user posts to the server with a property called _method, rewrite the request's method
     // To be that method; so if they post _method=PUT you can now allow browsers to POST to a route that gets
     // rewritten in this middleware to a PUT routea
     if (req.body && req.body._method) {
       req.method = req.body._method;
       delete req.body._method;
     }
   
     // let the next middleware run:
     next();
   };  

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(rewriteUnsupportedBrowserMethods);

app.use(session({
     name: 'AuthenticationState',
     secret: 'some secret string!',
     resave: false,
     saveUninitialized: false,
     cookie: {maxAge: 999999}   
}));

configRoutes(app);

app.listen(3000, () => {
  console.log("We've now got a server!");
  console.log('Your routes will be running on http://localhost:3000');
});
