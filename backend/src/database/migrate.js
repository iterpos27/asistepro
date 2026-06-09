const fs = require('fs');
const path = require('path');
const { loadBackendEnv } = require('../utils/env.util');

loadBackendEnv();

const { pool } = require('../config/database');

const migrations = [
  '001_schema.sql',
  '002_seed_planes.sql',
  '003_seed_super_admin.sql',
  '004_auth.sql',
  '005_multi_tenant.sql',
  '006_billing.sql',
  '007_sucursales.sql',
  '008_empleados.sql',
  '009_horarios.sql',
  '010_marcaciones.sql',
  '011_facturacion_estado_pagos.sql',
  '012_pagos_aprobacion.sql',
  '013_pagos_comprobantes.sql',
  '014_indexes_optimization.sql',
  '015_security_audit_dynamic_qr.sql',
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const existingSchema = await client.query("SELECT to_regclass('public.planes') AS table_name");
    const appliedResult = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));

    if (existingSchema.rows[0]?.table_name && appliedVersions.size === 0) {
      const baseline = migrations.filter((migration) => !['013_pagos_comprobantes.sql', '014_indexes_optimization.sql'].includes(migration));

      for (const migration of baseline) {
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [migration]);
        appliedVersions.add(migration);
      }

      console.log('Existing schema detected; baseline migrations marked as applied');
    }

    for (const migration of migrations) {
      if (appliedVersions.has(migration)) {
        console.log(`Skipping applied migration: ${migration}`);
        continue;
      }

      const filePath = path.join(__dirname, migration);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Running pending migration: ${migration}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration]);
    }

    console.log('Database migrations completed');
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

runMigrations()
  .catch((error) => {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
