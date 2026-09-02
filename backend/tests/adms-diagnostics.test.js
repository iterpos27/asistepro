const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createHash } = require('node:crypto');
const { createAdmsDiagnostics } = require('../src/routes/adms.routes');

async function setup(t, { trustProxy = false } = {}) {
  const app = express();
  app.set('trust proxy', trustProxy);
  const logs = [];
  let time = Date.parse('2026-09-02T21:00:00Z');
  app.use('/iclock', createAdmsDiagnostics({ log: value => logs.push(JSON.parse(value)), now: () => time }));
  app.use(express.json());
  app.use((req, res) => res.status(200).send('normal application'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (path, { method = 'GET', body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on('error', reject);
    req.end(body);
  });
  return { request, logs, advance: () => { time += 60000; } };
}

test('ADMS siempre devuelve 503 sin ACK, comandos ni HTML, incluso con JSON invalido', async t => {
  const app = await setup(t);
  for (const [path, method, body] of [
    ['/iclock/cdata?SN=TESTSERIAL&options=all', 'GET'],
    ['/iclock/getrequest?SN=TESTSERIAL', 'GET'],
    ['/iclock/cdata?SN=TESTSERIAL&table=ATTLOG&Stamp=3', 'POST', '4\t2026-09-02 16:01:17\t4\t1'],
    ['/iclock/cdata?SN=TESTSERIAL&table=options', 'POST', 'bad json'],
    ['/iclock/devicecmd?SN=TESTSERIAL', 'POST', 'ID=1&Return=0'],
    ['/iclock/unknown', 'GET'],
    ['/iclock/cdata?SN=TESTSERIAL', 'HEAD'],
  ]) {
    const result = await app.request(path, { method, body, headers: { 'content-type': 'application/json' } });
    assert.equal(result.status, 503);
    assert.equal(result.headers['x-asistepro-adms'], 'diagnostics-only');
    assert.equal(result.headers['retry-after'], '60');
    assert.doesNotMatch(result.text, /OK|GET OPTION|Stamp=|<html|DATA DELETE/);
  }
  assert.equal((await app.request('/api/health')).text, 'normal application');
  assert.equal((await app.request('/iclock-not-a-device')).status, 200);
});

test('logs acotados sin cuerpos, serial completo, IP, claves ni URL', async t => {
  const app = await setup(t);
  await app.request('/iclock/cdata?SN=TESTSERIAL&table=ATTLOG&token=query-secret&pushver=2.4.1', {
    method: 'POST', body: '4\t2026-09-02 16:01:17\t4\t1\nFACE template-secret',
    headers: { authorization: 'Bearer auth-secret', 'x-forwarded-for': '203.0.113.45' },
  });
  const text = JSON.stringify(app.logs);
  assert.doesNotMatch(text, /TESTSERIAL|query-secret|auth-secret|template-secret|16:01:17|203\.0\.113/);
  assert.equal(app.logs[0].serial_fingerprint, createHash('sha256').update('TESTSERIAL').digest('hex').slice(0, 16));
  assert.equal(app.logs[0].has_authorization, true);
  assert.equal(app.logs[0].acknowledged, false);
  for (let i = 0; i < 20; i++) await app.request('/iclock/getrequest?SN=TESTSERIAL');
  assert.equal(app.logs.length, 12);
  app.advance();
  await app.request('/iclock/getrequest?SN=TESTSERIAL');
  assert.equal(app.logs.length, 13);
});

test('no confunde cabeceras no confiables con TLS y distingue el proxy configurado', async t => {
  const direct = await setup(t);
  await direct.request('/iclock/cdata?SN=TESTSERIAL', { headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(direct.logs[0].transport, 'http');
  const proxied = await setup(t, { trustProxy: 1 });
  await proxied.request('/iclock/cdata?SN=TESTSERIAL', { headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(proxied.logs[0].transport, 'proxy_reported_https');
});

test('ignora seriales ambiguos/invalidos y no refleja parametros en la respuesta', async t => {
  const app = await setup(t);
  for (const query of ['SN=A&SN=B', 'SN[]=A', 'SN=%0Aforged', 'SN=', 'SN=' + 'x'.repeat(100)]) {
    const result = await app.request('/iclock/cdata?' + query);
    assert.equal(result.status, 503);
    assert.doesNotMatch(result.text, /forged|xxxx/);
  }
  assert.equal(app.logs.length, 0);
});
