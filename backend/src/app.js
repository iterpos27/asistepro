const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { auditLogger } = require('./middlewares/audit.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || (isProduction ? 100 : 10000));

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(auditLogger);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
