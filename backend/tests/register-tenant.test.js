const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/database');
const authService = require('../src/services/auth.service');
const facturacionService = require('../src/services/facturacion.service');

test.after(async () => {
  await pool.end();
});

test('registerTenant y checkoutSimulado - Flujo completo de registro y pago', async () => {
  const planRes = await pool.query("SELECT id FROM planes WHERE codigo = 'growth' LIMIT 1");
  const planId = planRes.rows[0]?.id;

  if (!planId) {
    console.log('Skipping registerTenant test: no growth plan found');
    return;
  }

  const randomSuffix = Date.now();
  const registerPayload = {
    nombre: `Empresa Test ${randomSuffix}`,
    identificacion_fiscal: `17929${randomSuffix}`,
    email: `test-${randomSuffix}@empresa.local`,
    telefono: '022222222',
    direccion: 'Av. Test 123',
    plan_id: planId,
    admin_nombre: 'AdminTest',
    admin_apellido: 'UserTest',
    admin_email: `admin-test-${randomSuffix}@empresa.local`,
    admin_password: 'Password123*',
  };

  const result = await authService.registerTenant(registerPayload);

  assert.ok(result.user);
  assert.equal(result.user.rol, 'ADMIN_EMPRESA');
  assert.equal(result.user.email, registerPayload.admin_email);
  assert.ok(result.tokens.accessToken);
  assert.ok(result.factura_id);

  const checkoutResult = await facturacionService.checkoutSimulado({
    factura_id: result.factura_id,
    empresa_id: result.user.empresa_id,
    banco: 'Stripe (Simulado)',
    monto: 49.00,
  });

  assert.ok(checkoutResult.pago);
  assert.equal(checkoutResult.pago.estado, 'registrado');
  assert.equal(checkoutResult.pago.metodo, 'tarjeta');
  assert.equal(checkoutResult.factura.estado, 'pagada');
});
