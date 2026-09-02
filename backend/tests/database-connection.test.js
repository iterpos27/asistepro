const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/config/database.js'), 'utf8');

function loadDatabase(env = {}, connect = async () => ({})) {
  const delays = [];
  const messages = [];
  let config;
  const sandbox = {
    require(name) {
      assert.equal(name, 'pg');
      return { Pool: class {
        constructor(options) { config = options; }
        connect() { return connect(); }
      } };
    },
    process: { env },
    console: { error: (...args) => messages.push(args), log() {} },
    setTimeout(callback, ms) { delays.push(ms); callback(); },
    module: { exports: {} },
  };
  vm.runInNewContext(source, sandbox);
  return { ...sandbox.module.exports, config, delays, messages };
}

test('produccion permite 10 segundos de conexion y limita el pool a 10', () => {
  const db = loadDatabase({ NODE_ENV: 'production', DATABASE_URL: 'postgres://example.invalid/db' });
  assert.equal(db.config.connectionTimeoutMillis, 10000);
  assert.equal(db.config.max, 10);
});

test('conserva valores locales y respeta configuracion explicita', () => {
  assert.equal(loadDatabase().config.connectionTimeoutMillis, 2000);
  const { config } = loadDatabase({ DB_POOL_CONN_TIMEOUT: '15000', DB_POOL_MAX: '5' });
  assert.equal(config.connectionTimeoutMillis, 15000);
  assert.equal(config.max, 5);
});

test('reintenta una conexion transitoria y devuelve el cliente sin ejecutar SQL', async () => {
  let calls = 0;
  const client = {};
  const db = loadDatabase({}, async () => {
    if (++calls < 3) throw new Error('Connection terminated due to connection timeout');
    return client;
  });
  assert.equal(await db.connectWithRetry({ attempts: 4, retryDelayMs: 5 }), client);
  assert.equal(calls, 3);
  assert.deepEqual(db.delays, [5, 5]);
});

test('agota cuatro intentos en produccion y conserva el error original', async () => {
  let calls = 0;
  const failure = new Error('database unreachable');
  const db = loadDatabase({ NODE_ENV: 'production', DATABASE_URL: 'postgres://example.invalid/db' }, async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(db.connectWithRetry(), error => error === failure);
  assert.equal(calls, 4);
  assert.deepEqual(db.delays, [3000, 3000, 3000]);
});

test('permite espera cero y rechaza reintentos invalidos sin abrir conexiones', async () => {
  let calls = 0;
  const db = loadDatabase({}, async () => { calls++; throw new Error('timeout'); });
  for (const attempts of [0, -1, 1.5, 11, NaN]) {
    await assert.rejects(db.connectWithRetry({ attempts }), /DB_CONNECT_RETRIES/);
  }
  await assert.rejects(db.connectWithRetry({ retryDelayMs: -1 }), /DB_CONNECT_RETRY_DELAY_MS/);
  assert.equal(calls, 0);
  await assert.rejects(db.connectWithRetry({ attempts: 2, retryDelayMs: 0 }), /timeout/);
  assert.deepEqual(db.delays, [0]);
});

test('la comprobacion ejecuta SELECT 1 y siempre libera el cliente', async () => {
  let released = false;
  const failure = new Error('query failed');
  const db = loadDatabase({}, async () => ({
    async query(sql) { assert.equal(sql, 'SELECT 1'); throw failure; },
    release() { released = true; },
  }));
  await assert.rejects(db.checkDatabaseConnection(), error => error === failure);
  assert.equal(released, true);
});

test('migraciones cierra el pool y falla limpiamente si no obtiene conexion', async () => {
  const migrate = fs.readFileSync(path.join(__dirname, '../src/database/migrate.js'), 'utf8');
  let ended = false;
  let attempts = 0;
  const fakeProcess = {};
  const sandbox = {
    require(name) {
      if (name === 'fs') return fs;
      if (name === 'path') return path;
      if (name === 'dotenv') return { config() {} };
      assert.equal(name, '../config/database');
      return {
        pool: { async end() { ended = true; } },
        async connectWithRetry() { attempts++; throw new Error('timeout'); },
        describeConnectionError: error => ({ message: error.message }),
      };
    },
    __dirname,
    process: fakeProcess,
    console: { error() {}, log() {} },
  };
  await vm.runInNewContext(migrate, sandbox);
  assert.equal(attempts, 1);
  assert.equal(ended, true);
  assert.equal(fakeProcess.exitCode, 1);
});
