const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { pool } = require('../src/config/database');
const { auditLogger } = require('../src/middlewares/audit.middleware');

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

test('auditLogger guarda metadata util y redacta campos sensibles', async () => {
  let queryValues;
  pool.query = async (_sql, values) => {
    queryValues = values;
    return { rows: [] };
  };

  const req = {
    method: 'POST',
    path: '/empleados',
    baseUrl: '/api/empleados',
    route: { path: '/' },
    originalUrl: '/api/empleados',
    ip: '',
    params: {},
    query: { source: 'test' },
    body: {
      nombres: 'Ana',
      password_acceso: 'super-secreto',
      nested: { refreshToken: 'token-secreto' },
    },
    tenant: { empresa_id: 'empresa-a' },
    auth: { usuario_id: 'usuario-a', rol: 'ADMIN_EMPRESA', email: 'admin@asistepro.local' },
    get(header) {
      return header === 'user-agent' ? 'node-test' : null;
    },
  };
  const res = new EventEmitter();
  res.statusCode = 201;

  await new Promise((resolve) => {
    auditLogger(req, res, resolve);
  });
  res.emit('finish');
  await new Promise((resolve) => setImmediate(resolve));

  const metadata = JSON.parse(queryValues[10]);
  assert.equal(queryValues[0], 'empresa-a');
  assert.equal(queryValues[1], 'usuario-a');
  assert.equal(queryValues[4], null);
  assert.equal(metadata.body.nombres, 'Ana');
  assert.equal(metadata.body.password_acceso, '[redacted]');
  assert.equal(metadata.body.nested.refreshToken, '[redacted]');
  assert.equal(metadata.actor.rol, 'ADMIN_EMPRESA');
});
