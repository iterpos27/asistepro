const { notifyOperationalAlert } = require('../services/monitoring.service');

const DEFAULT_SLOW_REQUEST_MS = 1500;

function requestPerformanceLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const slowRequestMs = Number(process.env.SLOW_REQUEST_MS || DEFAULT_SLOW_REQUEST_MS);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (durationMs < slowRequestMs) return;

    const payload = {
      message: `Solicitud lenta: ${Math.round(durationMs)}ms`,
      path: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
    };

    console.warn('[Slow Request]', payload);
    void notifyOperationalAlert(payload);
  });

  return next();
}

module.exports = {
  requestPerformanceLogger,
};
