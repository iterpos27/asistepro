const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/database');
const { runCronCleanup } = require('../src/controllers/saas.controller');
const suscripcionService = require('../src/services/suscripcion.service');

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
  delete process.env.CRON_SECRET;
});

test('runCronCleanup - rechaza solicitudes sin el secret correcto', async () => {
  process.env.CRON_SECRET = 'secreto-seguro';
  const req = {
    headers: { 'x-cron-secret': 'secreto-incorrecto' },
  };

  let resolveResponse;
  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });

  let resStatus = null;
  let resJson = null;
  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      resolveResponse();
      return this;
    },
  };

  runCronCleanup(req, res, (err) => {
    resolveResponse(err);
  });

  const err = await responsePromise;

  if (err) {
    assert.equal(err.statusCode, 401);
    assert.equal(err.message, 'No autorizado');
  } else {
    assert.equal(resStatus, 401);
    assert.equal(resJson.ok, false);
    assert.equal(resJson.message, 'No autorizado');
  }
});

test('runCronCleanup - ejecuta limpieza con el secret correcto', async () => {
  process.env.CRON_SECRET = 'secreto-seguro';
  const req = {
    headers: { 'x-cron-secret': 'secreto-seguro' },
  };

  const originalCheck = suscripcionService.checkSubscriptionExpirations;
  const originalCleanup = suscripcionService.runDatabaseCleanupAndSuspensions;

  let checkCalled = false;
  let cleanupCalled = false;

  suscripcionService.checkSubscriptionExpirations = async () => {
    checkCalled = true;
    return 3;
  };
  suscripcionService.runDatabaseCleanupAndSuspensions = async () => {
    cleanupCalled = true;
  };

  let resolveResponse;
  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });

  let resJson = null;
  const res = {
    json(data) {
      resJson = data;
      resolveResponse();
      return this;
    },
  };

  try {
    runCronCleanup(req, res, (err) => {
      if (err) resolveResponse(err);
    });

    const err = await responsePromise;
    if (err) throw err;

    assert.ok(checkCalled);
    assert.ok(cleanupCalled);
    assert.equal(resJson.ok, true);
    assert.equal(resJson.notificationsSentCount, 3);
  } finally {
    suscripcionService.checkSubscriptionExpirations = originalCheck;
    suscripcionService.runDatabaseCleanupAndSuspensions = originalCleanup;
  }
});
