const path = require('path');
const dotenv = require('dotenv');

function loadBackendEnv() {
  dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

  if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID) {
    process.env.NODE_ENV = 'production';
  }
}

function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const errors = [];
  const corsOrigin = process.env.CORS_ORIGIN || '';

  if (!process.env.DATABASE_URL) errors.push('DATABASE_URL es requerida');
  if (!process.env.JWT_ACCESS_SECRET) errors.push('JWT_ACCESS_SECRET es requerida');
  if (!process.env.JWT_REFRESH_SECRET) errors.push('JWT_REFRESH_SECRET es requerida');
  if (!corsOrigin) errors.push('CORS_ORIGIN es requerida');
  if (/localhost|127\.0\.0\.1/i.test(corsOrigin)) errors.push('CORS_ORIGIN no puede usar localhost');
  if (errors.length) {
    throw new Error(`Configuracion de produccion invalida: ${errors.join(', ')}`);
  }
}

module.exports = {
  loadBackendEnv,
  validateProductionEnv,
};
