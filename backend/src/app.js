const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const { auditLogger } = require('./middlewares/audit.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const { requestPerformanceLogger } = require('./middlewares/performance.middleware');
const { createAdmsDiagnostics } = require('./routes/adms.routes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.set('trust proxy', 1);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || (isProduction ? 100 : 10000));
const corsOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  isProduction ? 'https://asistepro.vercel.app' : 'http://localhost:5174',
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ''))
  .filter(Boolean);

function getHostFromOrigin(origin) {
  try {
    return origin ? new URL(origin).host : '';
  } catch (error) {
    return '';
  }
}

app.use(helmet());
// Protocolo del reloj fuera de /api. No pasar datos ADMS por JSON, auditoria
// ni por el fallback HTML. Solo diagnostico: no confirma/importa marcaciones.
app.use('/iclock', createAdmsDiagnostics());
app.use(
  cors((req, callback) => {
    const corsOptions = {
      origin: (origin, originCallback) => {
        if (process.env.NODE_ENV !== 'production') {
          return originCallback(null, true);
        }

        const normalizedOrigin = origin?.replace(/\/$/, '');
        const requestHost = req.get('host');
        const originHost = getHostFromOrigin(normalizedOrigin);
        const isSameHost = requestHost && originHost === requestHost;

        if (!normalizedOrigin || corsOrigins.includes(normalizedOrigin) || isSameHost) {
          return originCallback(null, true);
        }

        const error = new Error('Origen no permitido por CORS');
        error.statusCode = 403;
        return originCallback(error);
      },
      credentials: true,
    };

    callback(null, corsOptions);
  }),
);
app.use(
  express.json({
    limit: '4mb',
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.includes('/webhook')) {
        req.rawBody = buf;
      }
    }
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(requestPerformanceLogger);
app.use(auditLogger);

app.use('/api', routes);

if (isProduction) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
