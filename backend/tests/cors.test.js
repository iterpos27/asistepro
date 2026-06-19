const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';
process.env.CORS_ORIGIN = 'https://asistepro.vercel.app/';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/asistepro_test';

const app = require('../src/app');

async function withServer(callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('CORS permite el frontend de produccion aunque la variable tenga barra final', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://asistepro.vercel.app' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://asistepro.vercel.app');
  });
});

test('CORS rechaza un origen externo con 403', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://sitio-no-autorizado.example' },
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});
