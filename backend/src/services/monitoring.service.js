const ALERT_TIMEOUT_MS = Number(process.env.ALERT_TIMEOUT_MS || 3000);

function getVersion() {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT_SHA ||
    process.env.APP_VERSION ||
    'unknown'
  );
}

async function notifyOperationalAlert({ message, path, method, statusCode }) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl || process.env.NODE_ENV !== 'production') return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        service: 'asistepro-api',
        environment: process.env.NODE_ENV,
        version: getVersion(),
        statusCode,
        method,
        path,
        message,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    console.error('[Monitoring] No se pudo enviar la alerta', { message: error.message });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getVersion,
  notifyOperationalAlert,
};
