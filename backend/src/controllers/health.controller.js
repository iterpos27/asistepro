const { pool } = require('../config/database');
const { getVersion } = require('../services/monitoring.service');

function healthPayload() {
  return {
    service: 'asistepro-api',
    environment: process.env.NODE_ENV || 'development',
    version: getVersion(),
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

function getHealth(req, res) {
  res.json({
    ok: true,
    ...healthPayload(),
  });
}

async function getReadiness(req, res) {
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return res.json({
      ok: true,
      ...healthPayload(),
      database: 'ready',
      database_latency_ms: Date.now() - startedAt,
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      ...healthPayload(),
      database: 'unavailable',
    });
  }
}

module.exports = {
  getHealth,
  getReadiness,
};
