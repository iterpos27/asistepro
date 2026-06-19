const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');
const tenantService = require('../src/services/tenant.service');

const originalQuery = pool.query;
test.afterEach(() => {
  pool.query = originalQuery;
});

test('assertMonthlyImportsCapacity bloquea cuando supera la cuota del plan', async () => {
  pool.query = async () => ({ rows: [{ total: 2 }] });
  await assert.rejects(
    () => tenantService.assertMonthlyImportsCapacity({
      empresaId: 'empresa-a',
      plan: { limite_importaciones_mensuales: 2 },
      includeNew: 1,
    }),
    /Limite mensual de importaciones alcanzado/,
  );
});

test('assertIntegrationsCapacity permite continuar mientras la cuota no se supera', async () => {
  pool.query = async () => ({ rows: [{ total: 1 }] });
  const nextValue = await tenantService.assertIntegrationsCapacity({
    empresaId: 'empresa-a',
    plan: { limite_integraciones: 3 },
    includeNew: 1,
  });
  assert.equal(nextValue, 2);
});
