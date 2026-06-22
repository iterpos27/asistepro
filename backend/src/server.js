const { loadBackendEnv, validateProductionEnv } = require('./utils/env.util');

loadBackendEnv();
validateProductionEnv();

const app = require('./app');
const { checkDatabaseConnection } = require('./config/database');
const suscripcionService = require('./services/suscripcion.service');

const PORT = process.env.PORT || 4001;

async function startServer() {
  await checkDatabaseConnection();

  app.listen(PORT, () => {
    console.log(`ASISTEPRO API running on port ${PORT}`);
  });

  // Programar verificación de expiración solo fuera de producción o si se habilita explícitamente
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_IN_PROCESS_CRON === 'true') {
    // Ejecutar verificación de expiración de suscripciones al iniciar
    setTimeout(async () => {
      try {
        console.log('Running startup subscription expiration check...');
        const count = await suscripcionService.checkSubscriptionExpirations();
        console.log(`Startup subscription expiration check finished. Sent ${count} notifications.`);
      } catch (err) {
        console.error('Error running startup subscription expiration check:', err);
      }
    }, 5000); // esperar 5 segundos

    // Programar verificación cada 24 horas
    setInterval(async () => {
      try {
        console.log('Running daily subscription expiration check...');
        const count = await suscripcionService.checkSubscriptionExpirations();
        console.log(`Daily subscription expiration check finished. Sent ${count} notifications.`);
      } catch (err) {
        console.error('Error running daily subscription expiration check:', err);
      }
    }, 24 * 60 * 60 * 1000);
  } else {
    console.log('[SaaS Scheduler] In-process subscription check disabled in production. Use Render Cron Jobs with check-expirations script.');
  }
}

startServer().catch((error) => {
  console.error('Failed to start ASISTEPRO API');
  console.error({
    name: error?.name,
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    stack: error?.stack,
  });
  process.exit(1);
});
