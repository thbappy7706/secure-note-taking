const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config');
const apiRoutes = require('./routes');
const ApiError = require('./utils/ApiError');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, health checks and server-to-server calls are allowed.
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '32kb' }));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
