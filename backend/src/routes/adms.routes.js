const { Router } = require('express');
const { createHash } = require('node:crypto');

// Primera fase: comprobar el transporte del firmware, NO recibir asistencia.
// Nunca devolver 2xx/OK: el reloj podria avanzar su cursor sin persistencia.
// El SN declarado solo sirve para correlacionar pruebas, no autentica un equipo.
function createAdmsDiagnostics({ log = console.log, now = Date.now } = {}) {
  const router = Router();
  let windowStart = 0;
  let logged = 0;

  router.use((req, res) => {
    const time = now();
    if (time - windowStart >= 60000) { windowStart = time; logged = 0; }
    const url = new URL(req.originalUrl, 'http://adms.invalid');
    const serials = url.searchParams.getAll('SN');
    const serial = serials.length === 1 && /^[A-Za-z0-9_-]{1,40}$/.test(serials[0]) ? serials[0] : null;
    const path = ['/cdata', '/getrequest', '/devicecmd'].includes(req.path) ? req.path : 'other';

    // Cota global por proceso: sin mapas por IP/serial controlados por el cliente.
    // No registrar URL completa, IP, nombres, cuerpos, tokens ni plantillas.
    if (serial && path !== 'other' && logged < 12) {
      logged++;
      log(JSON.stringify({
        event: 'adms_transport_probe',
        time: new Date(time).toISOString(),
        serial_fingerprint: createHash('sha256').update(serial).digest('hex').slice(0, 16),
        method: ['GET', 'POST', 'HEAD'].includes(req.method) ? req.method : 'other',
        path,
        // En Render, TLS termina en el proxy. Esta observacion no prueba
        // autenticacion ni validacion del certificado por parte del firmware.
        transport: req.socket.encrypted ? 'direct_tls' : req.secure ? 'proxy_reported_https' : 'http',
        options: url.searchParams.get('options') === 'all',
        push_version: /^[0-9.]{1,16}$/.test(url.searchParams.get('pushver') || '')
          ? url.searchParams.get('pushver') : null,
        has_authorization: Boolean(req.headers.authorization),
        acknowledged: false,
      }));
    }

    res.set({
      'Cache-Control': 'no-store',
      'Retry-After': '60',
      'Connection': 'close',
      'X-AsistePro-ADMS': 'diagnostics-only',
    });
    res.status(503).type('text/plain').send('ADMS diagnostics only; attendance NOT accepted. Retry later.');
    // No leer cuerpos de asistencia ni dejarlos llegar a parsers/auditoria/API/SPA.
    // Cerrar despues de entregar la respuesta; cota de respaldo para clientes lentos.
    const socket = req.socket;
    const timer = setTimeout(() => socket.destroy(), 5000);
    timer.unref();
    socket.once('close', () => clearTimeout(timer));
    res.once('finish', () => socket.end());
  });
  return router;
}

module.exports = { createAdmsDiagnostics };
