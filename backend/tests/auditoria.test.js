const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/database');
const service = require('../src/services/auditoria.service');

test.after(async () => {
  await pool.end();
});

test('Auditoria service list function integration tests', async () => {
  // Get an active company
  const empresaRes = await pool.query("SELECT id FROM empresas LIMIT 2");
  if (empresaRes.rows.length === 0) {
    console.log('Skipping auditoria tests: no empresas found');
    return;
  }
  const empresa1 = empresaRes.rows[0].id;
  const empresa2 = empresaRes.rows[1]?.id;

  // Insert mock logs
  const logId1 = '00000000-0000-0000-0000-000000000001';
  const logId2 = '00000000-0000-0000-0000-000000000002';
  
  await pool.query("DELETE FROM logs_auditoria WHERE id IN ($1, $2)", [logId1, logId2]);
  
  await pool.query(
    "INSERT INTO logs_auditoria (id, empresa_id, accion, entidad, metodo, ruta) VALUES ($1, $2, 'test-action-1', 'test-entity', 'POST', '/api/test-route-1')",
    [logId1, empresa1]
  );
  if (empresa2) {
    await pool.query(
      "INSERT INTO logs_auditoria (id, empresa_id, accion, entidad, metodo, ruta) VALUES ($1, $2, 'test-action-2', 'test-entity', 'POST', '/api/test-route-2')",
      [logId2, empresa2]
    );
  }

  try {
    // 1. List logs without empresaId should return log1 (and log2 if empresa2 exists)
    const resAll = await service.list({ limit: 10, offset: 0 });
    const hasLog1 = resAll.items.some(item => item.id === logId1);
    assert.ok(hasLog1, 'Should find log1 when no empresaId filter is provided');
    if (empresa2) {
      const hasLog2 = resAll.items.some(item => item.id === logId2);
      assert.ok(hasLog2, 'Should find log2 when no empresaId filter is provided');
    }

    // 2. List logs with empresa1 should return log1 but NOT log2
    const resEmpresa1 = await service.list({ empresaId: empresa1, limit: 10, offset: 0 });
    const hasLog1Only = resEmpresa1.items.some(item => item.id === logId1);
    const hasLog2InEmpresa1 = resEmpresa1.items.some(item => item.id === logId2);
    assert.ok(hasLog1Only, 'Should find log1 when empresa1 filter is provided');
    assert.ok(!hasLog2InEmpresa1, 'Should NOT find log2 when empresa1 filter is provided');

  } finally {
    // Clean up
    await pool.query("DELETE FROM logs_auditoria WHERE id IN ($1, $2)", [logId1, logId2]);
  }
});
