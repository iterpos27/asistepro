const saasService = require('../services/saas.service');
const suscripcionService = require('../services/suscripcion.service');
const { asyncHandler } = require('../utils/async.util');

const overview = asyncHandler(async (req, res) => {
  const data = await saasService.getOverview();
  return res.json({ ok: true, data });
});

const tenants = asyncHandler(async (req, res) => {
  const data = await saasService.listTenants();
  return res.json({ ok: true, data });
});

const runCronCleanup = asyncHandler(async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    const error = new Error('No autorizado');
    error.statusCode = 401;
    throw error;
  }

  console.log('[Cron] Starting database cleanup and expiration checks...');
  const count = await suscripcionService.checkSubscriptionExpirations();
  await suscripcionService.runDatabaseCleanupAndSuspensions();
  console.log('[Cron] Cleanup and expiration checks completed successfully.');

  return res.json({
    ok: true,
    message: 'Base de datos limpia y notificaciones de suscripción enviadas con éxito.',
    notificationsSentCount: count,
  });
});

module.exports = {
  overview,
  tenants,
  runCronCleanup,
};

