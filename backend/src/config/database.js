const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'asistepro',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT || 2000),
});

async function checkDatabaseConnection() {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connection established');
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  checkDatabaseConnection,
};
