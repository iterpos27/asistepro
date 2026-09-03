const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createAdmsReceiver } = require('../src/routes/adms-receiver.routes');
const { parseAttendance, handshake } = require('../src/integrations/adms-protocol');

async function setup(t, options = {}) {
  const app = express(), logs = [], calls = [];
  const service = { contact: async serial => serial === 'TEST', accept: async (serial, records) => {
    calls.push(records); return { recibidas: records.length, nuevas: records.length };
  }, ...options.service };
  app.use('/iclock', createAdmsReceiver({ requireHttps: false, ...options, service, log: line => logs.push(line) }));
  app.use((req, res) => res.status(503).send('disabled'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path,
      method: body === undefined ? 'GET' : 'POST', headers }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject); req.end(body);
  });
  return { request, calls, logs };
}

test('ADMS directo negocia PUSH, acepta opciones y guarda ATTLOG antes del ACK', async t => {
  const app = await setup(t);
  const response = await app.request('/iclock/cdata?SN=TEST&options=all&pushver=2.4.1');
  assert.equal(response.status, 200); assert.match(response.text, /TransFlag=TransData AttLog/);
  assert.match(response.text, /Delay=30/); assert.match(response.text, /Stamp=0/);
  assert.doesNotMatch(response.text, /DATA|DELETE|USER|BIODATA|FACE/);
  assert.equal((await app.request('/iclock/cdata?SN=TEST&table=options', 'OEMVendor=ZK, LTD,PushVersion=2.4.1')).text, 'OK');
  assert.equal((await app.request('/iclock/getrequest?SN=TEST')).text, 'OK');
  assert.equal((await app.request('/iclock/cdata?SN=TEST&table=ATTLOG&Stamp=999999999', '4\t2026-09-02 16:01:17\t4\t1')).text, 'OK: 1');
  assert.equal(app.calls.length, 1); assert.equal(app.calls[0][0].status, 4);
  assert.doesNotMatch(app.logs.join(''), /TEST|16:01:17/);
  assert.match(app.logs.join(''), /"trusted":false/);
});

test('no ACK cuando falla persistencia, equipo pausado o serie desconocida', async t => {
  const app = await setup(t, { service: { accept: async () => { throw new Error('database password=secret'); } } });
  for (const serial of ['TEST', 'UNKNOWN']) {
    const result = await app.request(`/iclock/cdata?SN=${serial}&table=ATTLOG`, '4\t2026-09-02 16:01:17\t4\t1');
    assert.equal(result.status, 503); assert.doesNotMatch(result.text, /OK|secret/);
  }
  assert.doesNotMatch(app.logs.join(''), /password|secret/);
});

test('rechaza serial ambiguo, tablas biometricas, fechas falsas, compresion y exceso de datos', async t => {
  const app = await setup(t);
  const cases = [
    ['/iclock/cdata?SN=TEST&SN=OTHER&table=ATTLOG', 'x', 400],
    ['/iclock/cdata?SN=TEST&table=FACE', 'template', 503],
    ['/iclock/cdata?SN=TEST&table=ATTLOG&table=options', 'x', 400],
    ['/iclock/cdata?SN=TEST&table=ATTLOG', '4\t2026-02-30 12:00:00\t4\t1', 400],
    ['/iclock/cdata?SN=TEST&table=options', 'invalid', 400],
    ['/iclock/cdata?SN=TEST&table=ATTLOG', 'x'.repeat(524289), 413],
  ];
  for (const [path, body, status] of cases) assert.equal((await app.request(path, body)).status, status);
  assert.equal((await app.request('/iclock/cdata?SN=TEST&table=ATTLOG', 'x', { 'content-encoding': 'gzip' })).status, 415);
  assert.equal(app.calls.length, 0);
  assert.throws(() => parseAttendance('', 'TEST'), /invalid/);
  assert.match(handshake('TEST', '1.0'), /TransFlag=1000000000/);
});

test('HTTPS obligatorio no acepta una cabecera falsa y el limite global no crea mapas ilimitados', async t => {
  const secure = await setup(t, { requireHttps: true });
  assert.equal((await secure.request('/iclock/getrequest?SN=TEST', undefined, { 'x-forwarded-proto': 'https' })).status, 403);
  const limited = await setup(t, { maxRequests: 1 });
  assert.equal((await limited.request('/iclock/getrequest?SN=TEST')).status, 200);
  assert.equal((await limited.request('/iclock/getrequest?SN=TEST')).status, 429);
});
