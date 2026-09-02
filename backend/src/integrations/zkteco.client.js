const crypto = require('crypto');
const net = require('net');

const DEFAULT_PORT = 4370;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_UDP_PORT = 4000;
const DEFAULT_TIMEZONE_OFFSET = '-05:00';
const deviceReads = new Map();

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function configurationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function assertPrivateIpv4(ip) {
  if (net.isIP(ip) !== 4) {
    throw configurationError('La IP del biometrico debe ser una direccion IPv4 local valida');
  }

  const [a, b] = ip.split('.').map(Number);
  const isPrivate = a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);

  if (!isPrivate) {
    throw configurationError('Por seguridad solo se permiten direcciones IP privadas o locales');
  }
}

function normalizeDeviceConfig(config = {}) {
  const ip = String(config.ip || '').trim();
  assertPrivateIpv4(ip);

  const port = Number(config.puerto || DEFAULT_PORT);
  const timeout = Number(config.timeout_ms || DEFAULT_TIMEOUT_MS);
  const inport = Number(config.puerto_udp_local || DEFAULT_UDP_PORT);
  const timezoneOffset = String(config.zona_horaria_offset || DEFAULT_TIMEZONE_OFFSET).trim();

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw configurationError('El puerto del biometrico es invalido');
  }
  if (!Number.isInteger(inport) || inport < 1 || inport > 65535) {
    throw configurationError('El puerto UDP local es invalido');
  }
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
    throw configurationError('timeout_ms debe estar entre 1000 y 60000');
  }
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(timezoneOffset)) {
    throw configurationError('zona_horaria_offset debe tener formato -05:00');
  }

  const daysToImport = Number(config.dias_importar ?? 30);
  if (!Number.isInteger(daysToImport) || daysToImport < 1 || daysToImport > 3650) {
    throw configurationError('dias_importar debe ser un entero entre 1 y 3650');
  }
  const startDate = config.fecha_desde;
  if (startDate !== undefined && (
    typeof startDate !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))
    || new Date(`${startDate}T00:00:00Z`).toISOString().slice(0, 10) !== startDate
  )) {
    throw configurationError('fecha_desde debe ser una fecha valida YYYY-MM-DD');
  }

  let userMap = null;
  if (Object.hasOwn(config, 'usuarios_mapeo')) {
    if (!config.usuarios_mapeo || typeof config.usuarios_mapeo !== 'object' || Array.isArray(config.usuarios_mapeo)) {
      throw configurationError('usuarios_mapeo debe relacionar IDs del reloj con codigos de empleado');
    }
    userMap = Object.create(null);
    for (const [deviceId, employeeCode] of Object.entries(config.usuarios_mapeo)) {
      if (!deviceId.trim() || typeof employeeCode !== 'string' || !employeeCode.trim() || employeeCode.trim().length > 50) {
        throw configurationError('Cada vinculo debe tener un ID y un codigo de empleado valido');
      }
      userMap[deviceId.trim()] = employeeCode.trim();
    }
  }

  const userDates = config.usuarios_fecha_desde || {};
  if (typeof userDates !== 'object' || Array.isArray(userDates)
    || Object.values(userDates).some(value => !isValidDate(value))) {
    throw configurationError('Las fechas por usuario deben ser fechas validas YYYY-MM-DD');
  }
  return { ip, port, timeout, inport, timezoneOffset, daysToImport, startDate, userMap, userDates };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function deviceDateToTimestamp(value, timezoneOffset = DEFAULT_TIMEZONE_OFFSET) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Fecha de marcacion invalida recibida del biometrico');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${timezoneOffset}`;
}

function eventReference(deviceUserId, timestamp) {
  return crypto.createHash('sha256').update(`${deviceUserId}|${timestamp}`).digest('hex');
}

function normalizeAttendanceRecords(records, config = {}) {
  const { timezoneOffset, daysToImport, startDate, userMap, userDates } = normalizeDeviceConfig(config);
  const cutoff = Date.now() - daysToImport * 24 * 60 * 60 * 1000;

  return (Array.isArray(records) ? records : [])
    .map((record) => {
      const deviceUserId = String(record.deviceUserId ?? record.userId ?? '').trim();
      const deviceDate = record.recordTime || record.attTime;
      if (!deviceUserId || !deviceDate) return null;
      // Una lista explicita nunca importa usuarios cuya identidad no fue confirmada.
      if (userMap && !Object.hasOwn(userMap, deviceUserId)) return null;
      const timestamp = deviceDateToTimestamp(deviceDate, timezoneOffset);
      return {
        empleado_codigo: userMap ? userMap[deviceUserId] : deviceUserId,
        dispositivo_usuario_id: deviceUserId,
        marcado_en: timestamp,
        fecha_local: timestamp.slice(0, 10),
        referencia: eventReference(deviceUserId, timestamp),
      };
    })
    .filter((record) => {
      if (!record) return false;
      const userDate = userDates[record.dispositivo_usuario_id];
      if (userDate) return record.fecha_local >= userDate;
      return new Date(record.marcado_en).getTime() >= cutoff
        && (!startDate || record.fecha_local >= startDate);
    })
    .sort((a, b) => a.marcado_en.localeCompare(b.marcado_en));
}

function assignAttendanceTypes(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.empleado_codigo}|${record.fecha_local}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  const assigned = [];
  let omitted = 0;
  for (const group of groups.values()) {
    group.sort((a, b) => a.marcado_en.localeCompare(b.marcado_en));
    const count = group.length;
    if (count === 1) {
      assigned.push({ ...group[0], tipo: 'entrada' });
      continue;
    }
    if (count === 2) {
      assigned.push({ ...group[0], tipo: 'entrada' }, { ...group[1], tipo: 'salida' });
      continue;
    }

    assigned.push({ ...group[0], tipo: 'entrada' });
    assigned.push({ ...group[1], tipo: 'salida_almuerzo' });
    if (count >= 4) assigned.push({ ...group[count - 2], tipo: 'entrada_almuerzo' });
    assigned.push({ ...group[count - 1], tipo: 'salida' });
    omitted += Math.max(0, count - (count >= 4 ? 4 : 3));
  }

  return { records: assigned, omitted };
}

async function readZktecoDevice(config, ZKLibClass, options = {}) {
  const { ip, port } = normalizeDeviceConfig(config);
  const key = `${ip}:${port}`;
  const previous = deviceReads.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => readDevice(config, ZKLibClass, options));
  deviceReads.set(key, current);
  try {
    return await current;
  } finally {
    if (deviceReads.get(key) === current) deviceReads.delete(key);
  }
}

async function readDevice(config, ZKLibClass, options) {
  const normalized = normalizeDeviceConfig(config);
  // Carga diferida: el resto del backend puede iniciar aunque el conector no se use.
  const ZKLib = ZKLibClass || require('node-zklib');
  const device = new ZKLib(normalized.ip, normalized.port, normalized.timeout, normalized.inport);
  const { installReliableTcpReader } = require('./zkteco.tcp-reader');
  installReliableTcpReader(device);

  try {
    await device.createSocket();
    const info = await device.getInfo();
    let users = [];
    if (options.includeUsers) {
      const response = await device.getUsers();
      if (response?.err) throw response.err;
      if (!Array.isArray(response?.data || response)) throw new Error('Respuesta de usuarios invalida');
      // No exponer claves, tarjetas ni plantillas biometricas que entregue el SDK.
      users = (response.data || response).map(user => ({
        dispositivo_usuario_id: String(user.userId ?? '').trim(),
        nombre: String(user.name || '').trim(),
      })).filter(user => user.dispositivo_usuario_id);
    }
    const attendance = await device.getAttendances();
    if (attendance?.err) throw attendance.err;
    if (!Array.isArray(attendance?.data || attendance)) throw new Error('Respuesta de marcaciones invalida');
    const normalizedRecords = normalizeAttendanceRecords(attendance?.data || attendance, config);
    const assigned = assignAttendanceTypes(normalizedRecords);
    const allConfig = { ...config, usuarios_fecha_desde: {} };
    delete allConfig.usuarios_mapeo;
    const allRecords = normalizeAttendanceRecords(attendance?.data || attendance, allConfig);
    const unmapped = normalized.userMap
      ? allRecords.filter(record => !Object.hasOwn(normalized.userMap, record.dispositivo_usuario_id)) : [];
    return {
      info,
      users,
      ...(options.includeUsers ? { rawRecords: allRecords } : {}),
      unmappedCount: unmapped.length,
      unmappedUsers: new Set(unmapped.map(record => record.dispositivo_usuario_id)).size,
      records: assigned.records,
      omitted: assigned.omitted,
      totalRead: normalizedRecords.length,
    };
  } catch (error) {
    const cause = error?.err?.message || error?.message || error?.command || 'sin respuesta';
    const connectionError = new Error(`No se pudo comunicar con el biometrico ${normalized.ip}:${normalized.port}: ${cause}`);
    connectionError.statusCode = 502;
    connectionError.cause = error;
    throw connectionError;
  } finally {
    try {
      await device.disconnect();
    } catch {
      // El socket puede no haberse creado; no ocultar el error original.
    }
  }
}

module.exports = {
  isValidDate,
  assignAttendanceTypes,
  deviceDateToTimestamp,
  normalizeAttendanceRecords,
  normalizeDeviceConfig,
  readZktecoDevice,
};
