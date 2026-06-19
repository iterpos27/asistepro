const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');
const laboralService = require('../src/services/laboral.service');
const { createSolicitudSchema } = require('../src/validators/solicitud.validator');
const { defaultsForRole, mergePermissions, permissionGuard } = require('../src/utils/granular-permissions.util');

const originalQuery = pool.query;
test.afterEach(() => { pool.query = originalQuery; });

test('cierre mensual se consulta siempre dentro del tenant', async () => {
  const calls = [];
  pool.query = async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; };
  await laboralService.assertPeriodoAbierto('empresa-a', '2026-06-19T08:00:00-05:00');
  assert.match(calls[0].sql, /empresa_id = \$1/);
  assert.deepEqual(calls[0].values.slice(0, 2), ['empresa-a', '2026-06-19T08:00:00-05:00']);
});

test('cierre mensual bloquea cambios sobre un periodo cerrado', async () => {
  pool.query = async () => ({ rows: [{ id: 'cierre-a' }] });
  await assert.rejects(() => laboralService.assertPeriodoAbierto('empresa-a', '2026-06-19T08:00:00-05:00'), /periodo mensual esta cerrado/);
});

test('empleado solo recibe permisos de solicitudes por defecto', () => {
  const permissions = defaultsForRole('EMPLEADO');
  assert.equal(permissions.solicitudes.ver, true);
  assert.equal(permissions.solicitudes.crear, true);
  assert.equal(permissions.solicitudes.aprobar, false);
  assert.equal(permissions.auditoria.ver, false);
});

test('excepcion individual prevalece sobre perfil personalizado', () => {
  const permissions = mergePermissions('RRHH', { auditoria: { ver: true } }, { auditoria: { ver: false } });
  assert.equal(permissions.auditoria.ver, false);
});

test('permissionGuard responde 403 sin ejecutar la accion protegida', () => {
  const middleware = permissionGuard('cierres_mensuales', 'reabrir');
  let statusCode;
  let nextCalled = false;
  const response = { status(code) { statusCode = code; return this; }, json(payload) { return payload; } };
  middleware({ auth: { rol: 'RRHH', user: { permisos: defaultsForRole('RRHH') } } }, response, () => { nextCalled = true; });
  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
});

test('correccion exige marcacion para editar o anular', () => {
  const result = createSolicitudSchema.safeParse({ body: {
    tipo: 'correccion_marcacion', fecha_inicio: '2026-06-19', fecha_fin: '2026-06-19', motivo: 'Error en la hora registrada',
    datos_correccion: { accion: 'editar', tipo: 'entrada', marcado_en: '2026-06-19T08:00:00-05:00', sucursal_id: '22222222-2222-4222-8222-222222222222' },
  }, query: {}, params: {} });
  assert.equal(result.success, false);
});
