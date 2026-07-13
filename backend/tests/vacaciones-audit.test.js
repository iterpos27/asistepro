const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/database');
const authService = require('../src/services/auth.service');
const empleadoService = require('../src/services/empleado.service');
const vacacionesService = require('../src/services/vacaciones.service');

test.after(async () => {
  await pool.end();
});

test('Integration tests for vacation balance adjustments audit and fractional days', async () => {
  // 1. Get plan
  const planRes = await pool.query("SELECT id FROM planes WHERE codigo = 'starter' LIMIT 1");
  const planId = planRes.rows[0]?.id;
  if (!planId) {
    console.log('Skipping audit integration test: no starter plan found');
    return;
  }

  // 2. Register a tenant
  const randomSuffix = Date.now() + Math.floor(Math.random() * 1000);
  const tenantPayload = {
    nombre: `Empresa Vacaciones Audit ${randomSuffix}`,
    identificacion_fiscal: `18939${randomSuffix}`,
    email: `vac-audit-${randomSuffix}@empresa.local`,
    telefono: '099999998',
    direccion: 'Av. Vacaciones 123',
    plan_id: planId,
    admin_nombre: 'AdminAudit',
    admin_apellido: 'UserAudit',
    admin_email: `admin-audit-${randomSuffix}@empresa.local`,
    admin_password: 'Password123*',
    admin_cedula: '1723456780',
  };

  const regResult = await authService.registerTenant(tenantPayload);
  const empresaId = regResult.user.empresa_id;
  const adminUsuarioId = regResult.user.id;
  assert.ok(empresaId);

  // 3. Register an employee with initial balance
  const empPayload = {
    nombres: 'Daniela',
    apellidos: 'Mendoza',
    email: `daniela-${randomSuffix}@empresa.local`,
    crear_usuario: true,
    rol_acceso: 'EMPLEADO',
    password_acceso: 'Password123*',
    estado: 'activo',
    cedula: '1700000004',
    fecha_ingreso: '2022-01-01',
    saldo_vacaciones_inicial: 10,
  };

  const empleado = await empleadoService.createEmpleado(empresaId, empPayload);
  assert.ok(empleado.id);

  const anioActual = new Date().getFullYear();

  // 4. Test manual adjustment creates an audit trail
  const adjustPayload = {
    saldo_inicial: 15,
    dias_derecho: 16,
    dias_tomados: 2,
    motivo: 'Ajuste anual de demostracion',
  };

  const updatedSaldo = await vacacionesService.updateSaldo(
    empresaId,
    empleado.id,
    anioActual,
    adjustPayload,
    adminUsuarioId
  );

  assert.equal(Number(updatedSaldo.saldo_inicial), 15);
  assert.equal(Number(updatedSaldo.dias_derecho), 16);
  assert.equal(Number(updatedSaldo.dias_tomados), 2);

  // Verify audit log entry
  const auditRes = await pool.query(
    "SELECT * FROM vacaciones_ajustes WHERE empresa_id = $1 AND empleado_id = $2 ORDER BY ajustado_en DESC LIMIT 1",
    [empresaId, empleado.id]
  );
  assert.equal(auditRes.rows.length, 1);
  const auditRow = auditRes.rows[0];
  assert.equal(Number(auditRow.saldo_inicial_anterior), 10);
  assert.equal(Number(auditRow.saldo_inicial_nuevo), 15);
  assert.equal(Number(auditRow.dias_derecho_nuevo), 16);
  assert.equal(Number(auditRow.dias_tomados_nuevo), 2);
  assert.equal(auditRow.motivo, 'Ajuste anual de demostracion');
  assert.equal(auditRow.ajustado_por, adminUsuarioId);

  // 5. Test fractional day leaves deduction logic (e.g. 4 hours leave)
  const mockSolicitud = {
    fecha_inicio: `${anioActual}-06-15`,
    fecha_fin: `${anioActual}-06-15`,
    hora_inicio: '08:00:00',
    hora_fin: '12:00:00',
  };

  // Directly register approved vacations
  await vacacionesService.registrarVacacionesAprobadas(
    empresaId,
    empleado.id,
    mockSolicitud,
    null // no explicit datosAdicionales, let it auto-calculate
  );

  const saldoAfterVacations = await vacacionesService.getSaldoEmpleado(empresaId, empleado.id);
  // Initial dias_tomados was updated to 2 by adjust.
  // 4 hours is 240 mins. Over 480 mins (8 hours) is 0.5 days.
  // So dias_tomados should be 2 + 0.5 = 2.5 days.
  assert.equal(Number(saldoAfterVacations.saldo_actual.dias_tomados), 2.5);
  assert.equal(saldoAfterVacations.saldo_actual.dias_disponibles, 28.5); // 15 + 16 - 2.5
});
