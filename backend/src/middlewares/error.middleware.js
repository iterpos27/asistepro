function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
  });
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message =
    statusCode === 500 && isProduction
      ? 'Ocurrio un error interno en el servidor'
      : error.message || 'Error interno del servidor';

  if (statusCode >= 500) {
    console.error('[Error API]', {
      message: error.message,
      path: req.originalUrl,
      method: req.method,
      stack: isProduction ? undefined : error.stack,
    });
    void notifyOperationalAlert({
      message: error.message,
      path: req.originalUrl,
      method: req.method,
      statusCode,
    });
  }

  res.status(statusCode).json({
    ok: false,
    message,
    ...(isProduction ? {} : { stack: error.stack }),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
const { notifyOperationalAlert } = require('../services/monitoring.service');
