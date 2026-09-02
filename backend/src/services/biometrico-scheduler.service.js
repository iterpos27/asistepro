const integracionService = require('./integracion.service');

let running = false;

async function runCycle() {
  if (running) return;
  running = true;
  try {
    const results = await integracionService.syncConfiguredBiometrics();
    if (results.length) console.log('[Biometrico] Sincronizacion local:', results);
  } catch (error) {
    console.error('[Biometrico] Error del ciclo de sincronizacion:', error.message);
  } finally {
    running = false;
  }
}

function startBiometricScheduler() {
  const enabled = process.env.ENABLE_BIOMETRIC_SYNC
    ? process.env.ENABLE_BIOMETRIC_SYNC === 'true'
    : process.env.NODE_ENV !== 'production';
  if (!enabled) {
    console.log('[Biometrico] Sincronizacion local deshabilitada');
    return null;
  }

  const scanIntervalMs = Math.max(15000, Number(process.env.BIOMETRIC_SCAN_INTERVAL_MS || 30000));
  setTimeout(runCycle, 2000);
  const timer = setInterval(runCycle, scanIntervalMs);
  timer.unref();
  console.log(`[Biometrico] Sincronizacion local activa cada ${scanIntervalMs / 1000}s`);
  return timer;
}

module.exports = { runCycle, startBiometricScheduler };
