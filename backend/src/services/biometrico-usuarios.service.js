const { pool } = require('../config/database');
const { readZktecoDevice, isValidDate } = require('../integrations/zkteco.client');
const integraciones = require('./integracion.service');

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function validateDate(date) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
  if (!isValidDate(date) || date > today || Date.parse(`${date}T00:00:00-05:00`) < Date.now() - 3650 * 86400000) {
    fail('Selecciona una fecha valida, no futura, dentro de los ultimos 10 años');
  }
}

async function getIntegration(empresaId, id) {
  const item = await integraciones.findIntegracion(empresaId, id);
  if (!item) fail('Integracion no encontrada', 404);
  if (item.tipo !== 'biometrico' || !item.configuracion?.ip) fail('Selecciona un biometrico con conexion local');
  if (!item.configuracion.sucursal_id) fail('Configura primero la sucursal del biometrico');
  return item;
}

function buildUsers({ users, records, imported, mapping, employees }) {
  const byId = new Map(users.map(user => [user.dispositivo_usuario_id, {
    ...user, marcaciones: 0, sin_importar: 0, ultima_marcacion: null,
  }]));
  for (const record of records) {
    const id = record.dispositivo_usuario_id;
    if (!byId.has(id)) byId.set(id, { dispositivo_usuario_id: id, nombre: '(Usuario ausente del listado)', marcaciones: 0, sin_importar: 0, ultima_marcacion: null });
    const user = byId.get(id);
    user.marcaciones += 1;
    if (!imported.has(record.referencia)) user.sin_importar += 1;
    if (!user.ultima_marcacion || record.marcado_en > user.ultima_marcacion) user.ultima_marcacion = record.marcado_en;
  }
  const employeesByCode = new Map(employees.map(employee => [employee.codigo.toUpperCase(), employee]));
  return [...byId.values()].map(user => {
    const code = mapping[user.dispositivo_usuario_id] || null;
    const employee = code ? employeesByCode.get(code.toUpperCase()) : null;
    return { ...user, empleado_codigo: code, empleado_nombre: employee?.nombre || null,
      estado: !code ? 'sin_vincular' : employee ? 'vinculado' : 'revisar_empleado' };
  }).sort((a, b) => a.dispositivo_usuario_id.localeCompare(b.dispositivo_usuario_id, undefined, { numeric: true }));
}

async function listUsers({ empresaId, id, fechaDesde }) {
  validateDate(fechaDesde);
  const integration = await getIntegration(empresaId, id);
  const config = { ...integration.configuracion, fecha_desde: fechaDesde, dias_importar: 3650, usuarios_fecha_desde: {} };
  const device = await readZktecoDevice(config, undefined, { includeUsers: true });
  const [employeeResult, importedResult] = await Promise.all([
    pool.query(`SELECT e.id, e.codigo, CONCAT(e.nombres, ' ', e.apellidos) AS nombre,
      e.sucursal_habitual_id, s.nombre AS sucursal_nombre
      FROM empleados e LEFT JOIN sucursales s ON s.id = e.sucursal_habitual_id AND s.empresa_id = e.empresa_id
      WHERE e.empresa_id = $1 AND e.estado = 'activo' ORDER BY e.nombres, e.apellidos`, [empresaId]),
    pool.query(`SELECT origen_referencia FROM marcaciones WHERE empresa_id = $1 AND integracion_id = $2
      AND marcado_en >= $3::timestamptz AND anulada = FALSE AND estado <> 'rechazada'`,
    [empresaId, id, `${fechaDesde}T00:00:00-05:00`]),
  ]);
  const items = buildUsers({ users: device.users, records: device.rawRecords,
    imported: new Set(importedResult.rows.map(row => row.origen_referencia)),
    mapping: integration.configuracion.usuarios_mapeo || {}, employees: employeeResult.rows });
  return {
    items, empleados: employeeResult.rows, fecha_desde: fechaDesde, leido_en: new Date().toISOString(),
    integracion: { id, nombre: integration.nombre, estado: integration.estado,
      ip: integration.configuracion.ip, puerto: integration.configuracion.puerto,
      sucursal_id: integration.configuracion.sucursal_id,
      ultima_sincronizacion_en: integration.ultima_sincronizacion_en,
      ultima_ejecucion_estado: integration.ultima_ejecucion_estado,
      ultima_ejecucion_resumen: integration.ultima_ejecucion_resumen },
    resumen: { usuarios: items.length, sin_vincular: items.filter(user => user.estado === 'sin_vincular').length,
      marcaciones_sin_vincular: items.filter(user => user.estado === 'sin_vincular').reduce((sum, user) => sum + user.sin_importar, 0) },
  };
}

function validateLink(config, deviceId, employeeCode) {
  const mapping = config.usuarios_mapeo || {};
  if (mapping[deviceId] && mapping[deviceId].toUpperCase() !== employeeCode.toUpperCase()) {
    fail('Este usuario ya esta vinculado a otro empleado. No se reasigna su historial desde esta pantalla.', 409);
  }
  if (Object.entries(mapping).some(([key, code]) => key !== deviceId && code.toUpperCase() === employeeCode.toUpperCase())) {
    fail('El empleado ya esta vinculado a otro ID de este biometrico', 409);
  }
}

async function linkUser({ empresaId, usuarioId, id, deviceId, empleadoId, fechaDesde }, dependencies = {}) {
  validateDate(fechaDesde);
  // Confirmar existencia en el equipo; no crear un vinculo para un ID escrito arbitrariamente.
  const snapshot = await (dependencies.listUsers || listUsers)({ empresaId, id, fechaDesde });
  if (!snapshot.items.some(user => user.dispositivo_usuario_id === deviceId)) fail('Usuario no encontrado en el biometrico', 404);
  const client = await (dependencies.pool || pool).connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT * FROM integraciones_externas WHERE empresa_id = $1 AND id = $2 FOR UPDATE`, [empresaId, id]);
    const integration = result.rows[0];
    if (!integration || integration.tipo !== 'biometrico') fail('Integracion no encontrada', 404);
    if (integration.configuracion.ip !== snapshot.integracion.ip
      || integration.configuracion.puerto !== snapshot.integracion.puerto
      || integration.configuracion.sucursal_id !== snapshot.integracion.sucursal_id) {
      fail('La configuracion cambio; vuelve a consultar', 409);
    }
    const employeeResult = await client.query(`SELECT id, codigo FROM empleados WHERE empresa_id = $1 AND id = $2 AND estado = 'activo' FOR SHARE`, [empresaId, empleadoId]);
    const employee = employeeResult.rows[0];
    if (!employee) fail('Empleado activo no encontrado en esta empresa', 404);
    validateLink(integration.configuracion, deviceId, employee.codigo);
    const config = { ...integration.configuracion,
      usuarios_mapeo: { ...(integration.configuracion.usuarios_mapeo || {}), [deviceId]: employee.codigo },
      usuarios_fecha_desde: { ...(integration.configuracion.usuarios_fecha_desde || {}), [deviceId]: fechaDesde } };
    await client.query(`UPDATE integraciones_externas SET configuracion = $3::jsonb,
      actualizado_por = $4, actualizado_en = NOW() WHERE empresa_id = $1 AND id = $2`, [empresaId, id, JSON.stringify(config), usuarioId]);
    await client.query(`INSERT INTO integracion_ejecuciones (integracion_id, empresa_id, ejecutado_por, accion, estado, resumen, errores)
      VALUES ($1,$2,$3,'vincular_usuario_biometrico','ok',$4::jsonb,'[]'::jsonb)`,
    [id, empresaId, usuarioId, JSON.stringify({ dispositivo_usuario_id: deviceId, empleado_codigo: employee.codigo, fecha_desde: fechaDesde })]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  // El vinculo se conserva si la red falla; el siguiente ciclo activo reintentara.
  try {
    const result = await (dependencies.runIntegration || integraciones.runIntegration)({ empresaId, usuarioId, id, payload: {} });
    return { vinculado: true, ...result };
  } catch (error) {
    return { vinculado: true, importacion_pendiente: true, errores: [{ motivo: error.message }] };
  }
}

module.exports = { listUsers, linkUser, buildUsers, validateLink, validateDate };
