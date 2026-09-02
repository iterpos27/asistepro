const { Pool } = require('pg');

const useConnectionString = Boolean(process.env.DATABASE_URL);
const useSsl = process.env.DB_SSL === 'true';
const isProduction = process.env.NODE_ENV === 'production';

if (process.env.NODE_ENV === 'production' && !useConnectionString) {
  throw new Error('DATABASE_URL es requerida en produccion');
}

const pool = new Pool({
  ...(useConnectionString
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'asistepro',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || (isProduction ? 10 : 20)),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT || (isProduction ? 10000 : 2000)),
});

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function describeConnectionError(error) {
  return {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
  };
}

async function connectWithRetry(options = {}) {
  const attempts = Number(options.attempts
    ?? (process.env.DB_CONNECT_RETRIES || (isProduction ? 4 : 1)));
  const retryDelayMs = Number(options.retryDelayMs
    ?? (process.env.DB_CONNECT_RETRY_DELAY_MS || 3000));
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    throw new Error('DB_CONNECT_RETRIES debe ser un entero entre 1 y 10');
  }
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 60000) {
    throw new Error('DB_CONNECT_RETRY_DELAY_MS debe ser un entero entre 0 y 60000');
  }
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await pool.connect();
    } catch (error) {
      lastError = error;
      console.error(
        `[Database] Connection attempt ${attempt}/${attempts} failed`,
        describeConnectionError(error),
      );

      if (attempt < attempts) {
        await wait(retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function checkDatabaseConnection() {
  const client = await connectWithRetry();

  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connection established');
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  connectWithRetry,
  describeConnectionError,
  checkDatabaseConnection,
};
