const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUsers, validateLink, validateDate, linkUser } = require('../src/services/biometrico-usuarios.service');
const { biometricUsersSchema, biometricLinkSchema } = require('../src/validators/integracion.validator');

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
const uuid = '00000000-0000-4000-8000-000000000001';

test('inventario diferencia usuarios sin vincular, empleado inactivo y eventos importados', () => {
  const items = buildUsers({ users: [{ dispositivo_usuario_id: '2', nombre: 'Amin' }, { dispositivo_usuario_id: '52', nombre: 'Prueba' }, { dispositivo_usuario_id: '7', nombre: 'Inactivo' }],
    records: [{ dispositivo_usuario_id: '52', referencia: 'a', marcado_en: `${today}T08:00:00-05:00` }, { dispositivo_usuario_id: '2', referencia: 'b', marcado_en: `${today}T07:00:00-05:00` }],
    imported: new Set(['b']), mapping: { 2: 'AMIN', 7: 'INACTIVO' }, employees: [{ codigo: 'AMIN', nombre: 'Amin Alarcon' }] });
  assert.equal(items.find(item => item.dispositivo_usuario_id === '52').sin_importar, 1);
  assert.equal(items.find(item => item.dispositivo_usuario_id === '52').estado, 'sin_vincular');
  assert.equal(items.find(item => item.dispositivo_usuario_id === '2').sin_importar, 0);
  assert.equal(items.find(item => item.dispositivo_usuario_id === '7').estado, 'revisar_empleado');
});

test('permite recuperar el mismo vinculo pero bloquea reasignaciones y empleados duplicados', () => {
  const config = { usuarios_mapeo: { 2: 'AMIN', 4: 'ITER' } };
  validateLink(config, '2', 'amin');
  validateLink(config, '52', 'NUEVO');
  assert.throws(() => validateLink(config, '2', 'NUEVO'), { statusCode: 409 });
  assert.throws(() => validateLink(config, '52', 'iter'), { statusCode: 409 });
});

test('valida fecha real, no futura, y esquemas de consulta y vinculo', () => {
  validateDate(today);
  for (const date of ['2026-02-30', '2099-01-01', '2000-01-01', 'bad']) assert.throws(() => validateDate(date));
  const payload = { params: { id: uuid }, query: {}, body: { dispositivo_usuario_id: '52', empleado_id: uuid, fecha_desde: today } };
  assert.equal(biometricLinkSchema.safeParse(payload).success, true);
  assert.equal(biometricLinkSchema.safeParse({ ...payload, body: { ...payload.body, empleado_id: 'otro' } }).success, false);
  assert.equal(biometricUsersSchema.safeParse({ params: { id: uuid }, query: { fecha_desde: today } }).success, true);
  assert.equal(biometricUsersSchema.safeParse({ params: { id: uuid }, query: {} }).success, false);
});

function dependencies({ missingEmployee = false, offline = false, absentUser = false } = {}) {
  const calls = [];
  const config = { ip: '192.168.0.125', puerto: 4370, sucursal_id: 'matriz', usuarios_mapeo: { 2: 'AMIN' }, fecha_desde: today };
  return { calls,
    listUsers: async () => ({ items: absentUser ? [] : [{ dispositivo_usuario_id: '52' }], integracion: { ip: config.ip, puerto: config.puerto, sucursal_id: config.sucursal_id } }),
    pool: { connect: async () => ({ query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('SELECT * FROM integraciones_externas')) return { rows: [{ tipo: 'biometrico', configuracion: config }] };
      if (sql.includes('SELECT id, codigo FROM empleados')) return { rows: missingEmployee ? [] : [{ id: uuid, codigo: 'EMP-52' }] };
      return { rows: [] };
    }, release: () => calls.push({ sql: 'release' }) }) },
    runIntegration: async (args) => { calls.push({ sql: 'sync', values: args }); if (offline) throw new Error('equipo desconectado'); return { resumen: { sincronizadas: 1, rechazadas: 0 }, errores: [] }; },
  };
}
const args = { empresaId: 'tenant', usuarioId: 'actor', id: uuid, deviceId: '52', empleadoId: uuid, fechaDesde: today };

test('guarda solo el nuevo vinculo y su fecha, audita al actor y sincroniza despues del commit', async () => {
  const deps = dependencies();
  const result = await linkUser(args, deps);
  assert.equal(result.vinculado, true);
  const write = deps.calls.find(call => call.sql.startsWith('UPDATE'));
  const config = JSON.parse(write.values[2]);
  assert.deepEqual(config.usuarios_mapeo, { 2: 'AMIN', 52: 'EMP-52' });
  assert.deepEqual(config.usuarios_fecha_desde, { 52: today });
  assert.equal(config.fecha_desde, today);
  assert.equal(write.values[0], 'tenant');
  assert.equal(write.values[3], 'actor');
  assert.ok(deps.calls.findIndex(call => call.sql === 'COMMIT') < deps.calls.findIndex(call => call.sql === 'sync'));
});

test('empleado ajeno/inactivo produce rollback sin actualizar ni sincronizar', async () => {
  const deps = dependencies({ missingEmployee: true });
  await assert.rejects(linkUser(args, deps), { statusCode: 404 });
  assert.ok(deps.calls.some(call => call.sql === 'ROLLBACK'));
  assert.ok(!deps.calls.some(call => call.sql.startsWith('UPDATE') || call.sql === 'sync'));
});

test('ID inexistente se rechaza antes de iniciar una transaccion', async () => {
  const deps = dependencies({ absentUser: true });
  await assert.rejects(linkUser(args, deps), { statusCode: 404 });
  assert.equal(deps.calls.length, 0);
});

test('si falla la importacion no se pierde el vinculo ni se informa exito total', async () => {
  const deps = dependencies({ offline: true });
  const result = await linkUser(args, deps);
  assert.equal(result.vinculado, true);
  assert.equal(result.importacion_pendiente, true);
  assert.match(result.errores[0].motivo, /desconectado/);
  assert.ok(deps.calls.some(call => call.sql === 'COMMIT'));
});
