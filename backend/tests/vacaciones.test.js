const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/database');
const authService = require('../src/services/auth.service');
const empleadoService = require('../src/services/empleado.service');
const vacacionesService = require('../src/services/vacaciones.service');
const solicitudService = require('../src/services/solicitud.service');

test.after(async () => {
  await pool.end();
});

test('Integration tests for vacation balance system', async () => {
  // 1. Get starter plan
  const planRes = await pool.query("SELECT id FROM planes WHERE codigo = 'starter' LIMIT 1");
  const planId = planRes.rows[0]?.id;
  if (!planId) {
    console.log('Skipping vacation integration test: no starter plan found');
    return;
  }

  // 2. Register a tenant
  const randomSuffix = Date.now() + Math.floor(Math.random() * 1000);
  const tenantPayload = {
    nombre: `Empresa Vacaciones ${randomSuffix}`,
    identificacion_fiscal: `17939${randomSuffix}`,
    email: `vacaciones-${randomSuffix}@empresa.local`,
    telefono: '099999998',
    direccion: 'Av. Vacaciones 123',
    plan_id: planId,
    admin_nombre: 'AdminVacaciones',
    admin_apellido: 'UserVacaciones',
    admin_email: `admin-vac-${randomSuffix}@empresa.local`,
    admin_password: 'Password123*',
    admin_cedula: '1723456780',
  };

  const regResult = await authService.registerTenant(tenantPayload);
  const empresaId = regResult.user.empresa_id;
  assert.ok(empresaId);

  // 3. Register an employee with initial vacation balance
  const empPayload = {
    nombres: 'Roberto',
    apellidos: 'Gomez',
    email: `roberto-${randomSuffix}@empresa.local`,
    crear_usuario: true,
    rol_acceso: 'EMPLEADO',
    password_acceso: 'Password123*',
    estado: 'activo',
    cedula: '1700000003',
    fecha_ingreso: '2020-06-01', // completed 6 years by 2026
    saldo_vacaciones_inicial: 12.5,
  };

  const empleado = await empleadoService.createEmpleado(empresaId, empPayload);
  assert.ok(empleado.id);

  // 4. Verify vacation balance was registered automatically
  const anioActual = new Date().getFullYear();
  const info = await vacacionesService.getSaldoEmpleado(empresaId, empleado.id);
  
  assert.equal(info.empleado.id, empleado.id);
  assert.equal(Number(info.saldo_actual.saldo_inicial), 12.5);
  // Ecuador labor code check:
  // Hired in 2020-06-01.
  // By end of 2026: 2026-12-31 - 2020-06-01 = ~6.5 years.
  // Completed years: 6.
  // Formula: service years < 5 -> 15 days, >=5 -> 15 + (years - 5), max 30.
  // For 6 years service, entitlement should be 15 + (6 - 5) = 16 days.
  assert.equal(Number(info.saldo_actual.dias_derecho), 16);
  assert.equal(Number(info.saldo_actual.dias_tomados), 0);
  assert.equal(info.saldo_actual.dias_disponibles, 28.5); // 12.5 + 16 - 0

  // 5. Test manual HR adjustment (updateSaldo)
  const updatedSaldo = await vacacionesService.updateSaldo(empresaId, empleado.id, anioActual, {
    saldo_inicial: 15,
    notas: 'Ajuste manual de vacaciones por RRHH',
  });
  assert.equal(Number(updatedSaldo.saldo_inicial), 15);
  assert.equal(updatedSaldo.notas, 'Ajuste manual de vacaciones por RRHH');

  const updatedInfo = await vacacionesService.getSaldoEmpleado(empresaId, empleado.id);
  assert.equal(updatedInfo.saldo_actual.dias_disponibles, 31); // 15 + 16 - 0

  // 6. Test vacation request approval hook
  // Create a vacation solicitud
  const db = pool;
  const solRes = await db.query(
    `INSERT INTO solicitudes (empresa_id, empleado_id, tipo, fecha_inicio, fecha_fin, motivo, estado, solicitado_por)
     VALUES ($1, $2, 'vacaciones', '2026-07-01', '2026-07-05', 'Vacaciones anuales', 'pendiente', $3)
     RETURNING *`,
    [empresaId, empleado.id, regResult.user.id]
  );
  const solicitud = solRes.rows[0];
  assert.ok(solicitud.id);

  // Set status to 'validada' to simulate supervisor validation
  await db.query("UPDATE solicitudes SET estado = 'validada' WHERE id = $1", [solicitud.id]);

  // Approve request using solicitudService as Admin_Empresa
  // July 1st to July 5th (inclusive) is 5 days.
  // We'll approve it without additional metadata first.
  await solicitudService.reviewSolicitud({
    empresaId,
    solicitudId: solicitud.id,
    reviewerId: regResult.user.id,
    auth: { rol: 'ADMIN_EMPRESA', usuario_id: regResult.user.id },
    decision: 'aprobar',
    comentario: 'Disfruta tus vacaciones',
  });

  // Verify days_tomados increased
  const postApprovalInfo = await vacacionesService.getSaldoEmpleado(empresaId, empleado.id);
  assert.equal(Number(postApprovalInfo.saldo_actual.dias_tomados), 5);
  assert.equal(postApprovalInfo.saldo_actual.dias_disponibles, 26); // 15 + 16 - 5
});
