const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { loginRateLimit, registerRateLimit } = require('../src/middlewares/auth-rate-limit.middleware');

async function withServer(middleware, handler, callback) {
  const app = express();
  app.use(express.json());
  app.post('/test', middleware, handler);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}/test`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('login limita el intento fallido numero 11 dentro de la ventana', async () => {
  await withServer(loginRateLimit, (req, res) => res.status(401).json({ ok: false }), async (url) => {
    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      statuses.push(response.status);
    }

    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.equal(statuses[10], 429);
  });
});

test('registro limita la solicitud numero 6 dentro de la ventana', async () => {
  await withServer(registerRateLimit, (req, res) => res.status(201).json({ ok: true }), async (url) => {
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      statuses.push(response.status);
    }

    assert.deepEqual(statuses.slice(0, 5), Array(5).fill(201));
    assert.equal(statuses[5], 429);
  });
});
