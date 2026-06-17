const path = require('path');
const { loadBackendEnv } = require('../utils/env.util');

loadBackendEnv();

const { pool, checkDatabaseConnection } = require('../config/database');
const suscripcionService = require('../services/suscripcion.service');

async function run() {
  console.log('Starting subscription expiration check...');
  try {
    await checkDatabaseConnection();
    const count = await suscripcionService.checkSubscriptionExpirations();
    console.log(`Expiration check finished. Sent ${count} notifications.`);
    process.exit(0);
  } catch (error) {
    console.error('Expiration check failed:', error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // ignore
    }
  }
}

run();
