const { Router } = require('express');
const { createHash } = require('node:crypto');
const { parseAttendance, validOptions, handshake } = require('../integrations/adms-protocol');
const store = require('../services/adms-receiver.service');

function readBody(req, limit, timeoutMs) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const cleanup = () => { clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', failed); };
    const failed = error => { cleanup(); reject(error); };
    const aborted = () => failed(new Error('aborted_body'));
    const data = chunk => { size += chunk.length; if (size > limit) { req.pause(); failed(new Error('large_body')); } else chunks.push(chunk); };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    const timer = setTimeout(() => { req.pause(); failed(new Error('body_timeout')); }, timeoutMs);
    timer.unref();
    req.on('data', data); req.once('end', end); req.once('aborted', aborted); req.once('error', failed);
  });
}

function createAdmsReceiver({ service = store, log = console.log, now = Date.now, requireHttps = true,
  maxRequests = 300, bodyTimeoutMs = 15000 } = {}) {
  const router = Router(); let windowStart = 0, requests = 0, active = 0;
  router.use(async (req, res, next) => {
    const time = now();
    if (time-windowStart >= 60000) { windowStart=time; requests=0; }
    const send = (code, text) => {
      // Drenar sin almacenar el resto permite entregar el rechazo a clientes
      // que ya enviaron un lote grande; el socket se cierra con una cota corta.
      let replied = false, drainTimer;
      const reply = () => {
        if (replied) return;
        replied = true;
        clearTimeout(drainTimer);
        req.off('end', reply);
        if (res.destroyed) return;
        res.set({ 'Cache-Control': 'no-store', 'Connection': 'close', 'X-AsistePro-ADMS': 'unverified-inbox' });
        if (code >= 400) res.set('Retry-After', '60');
        res.status(code).type('text/plain').send(text);
        const timer = setTimeout(() => req.socket.destroy(), 2000); timer.unref();
        req.socket.once('close', () => clearTimeout(timer));
      };
      req.once('error', reply);
      if (req.complete || req.destroyed) reply();
      else {
        req.once('end', reply);
        drainTimer = setTimeout(reply, 2000); drainTimer.unref();
        req.resume();
      }
    };
    if (++requests > maxRequests || active >= 4) { send(429, 'Retry later'); return; }
    const url = new URL(req.originalUrl, 'http://adms.invalid');
    const serials = url.searchParams.getAll('SN');
    const serial = serials.length === 1 && /^[A-Za-z0-9_-]{1,40}$/.test(serials[0]) ? serials[0] : null;
    if (!serial) { send(400, 'Invalid request'); return; }
    if (requireHttps && !req.secure) { send(403, 'HTTPS required'); return; }
    if (['table', 'options', 'pushver', 'Stamp'].some(key => url.searchParams.getAll(key).length > 1)) { send(400, 'Invalid request'); return; }
    const supported = (req.method === 'GET' && (req.path === '/getrequest' || (req.path === '/cdata' && url.searchParams.get('options') === 'all')))
      || (req.method === 'POST' && req.path === '/cdata' && ['options', 'ATTLOG'].includes(url.searchParams.get('table')));
    if (!supported) { send(503, 'Attendance only; unsupported request'); return; }
    active++;
    try {
      if (!await service.contact(serial)) { next(); return; }
      if (req.method === 'GET') { send(200, req.path === '/getrequest' ? 'OK' : handshake(serial, url.searchParams.get('pushver'))); return; }
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') { send(415, 'Encoding not supported'); return; }
      const isOptions = url.searchParams.get('table') === 'options';
      const limit = isOptions ? 16384 : 524288;
      if (Number(req.headers['content-length']) > limit) { send(413, 'Batch too large'); return; }
      const body = await readBody(req, limit, bodyTimeoutMs);
      if (isOptions) { const valid = validOptions(body); send(valid ? 200 : 400, valid ? 'OK' : 'Invalid options'); return; }
      const records = parseAttendance(body, serial);
      const result = await service.accept(serial, records);
      log(JSON.stringify({ event: 'adms_inbox_saved', serial_fingerprint: createHash('sha256').update(serial).digest('hex').slice(0, 16),
        received: result.recibidas, inserted: result.nuevas, trusted: false }));
      send(200, `OK: ${result.recibidas}`);
    } catch (error) {
      // No seriales, cuerpos, consultas, IPs ni mensajes internos en los logs/respuesta.
      const status = error.message === 'invalid_attlog' ? 400 : error.message === 'large_body' ? 413 : error.message === 'body_timeout' ? 408 : 503;
      log(JSON.stringify({ event: 'adms_inbox_rejected', status }));
      if (!res.headersSent && !res.destroyed) send(status, 'Not saved; retry later');
    } finally { active--; }
  });
  return router;
}
module.exports = { createAdmsReceiver };
