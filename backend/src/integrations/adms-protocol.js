const { createHash } = require('node:crypto');

function parseAttendance(body, serial) {
  const lines = body.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length || lines.length > 10000) throw new Error('invalid_attlog');
  return lines.map(line => {
    const fields = line.split('\t');
    const [userId, localTime, status, verification] = fields;
    if (fields.length < 4 || fields.length > 12 || !/^[A-Za-z0-9_-]{1,24}$/.test(userId)
      || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(localTime)
      || !/^\d{1,3}$/.test(status) || !/^\d{1,3}$/.test(verification)
      || fields.slice(4).some(value => !/^\d{0,12}$/.test(value))) throw new Error('invalid_attlog');
    const date = new Date(localTime.replace(' ', 'T') + 'Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19).replace('T', ' ') !== localTime) throw new Error('invalid_attlog');
    const numericStatus = Number(status), numericVerification = Number(verification);
    return { userId, localTime, status: numericStatus, verification: numericVerification,
      referencia: createHash('sha256').update(`${serial}|${userId}|${localTime}|${numericStatus}|${numericVerification}`).digest('hex') };
  });
}

function validOptions(body) {
  const entries = body.replace(/\x00+$/, '').trim().replace(/,+$/, '')
    .split(/,(?=\s*[~A-Za-z_][A-Za-z0-9_~]*=)/).filter(entry => entry.trim());
  return entries.length > 0 && entries.length <= 512
    && entries.every(entry => /^[~A-Za-z_][A-Za-z0-9_~]*=[^\x00]*$/.test(entry.trim()));
}

function handshake(serial, pushVersion) {
  const [major = 0, minor = 0] = String(pushVersion || '').split('.').map(Number);
  // No confiamos en cursores enviados por clientes sin autenticacion: un falso
  // Stamp no debe hacer saltar eventos reales. Los reenvios se deduplican en DB.
  return [`GET OPTION FROM: ${serial}`, 'Stamp=0', 'ATTLOGStamp=0', 'ErrorDelay=60', 'Delay=30',
    'TransInterval=1', major > 2 || (major === 2 && minor >= 2) ? 'TransFlag=TransData AttLog' : 'TransFlag=1000000000',
    'Realtime=1', 'Encrypt=0', 'ServerVer=AsistePro-Inbox-1'].join('\n') + '\n';
}

module.exports = { parseAttendance, validOptions, handshake };
