const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
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
  '014_configuracion_modulos.sql',
  '014_indexes_optimization.sql',
  '015_security_audit_dynamic_qr.sql',
  '016_dynamic_qr_cleanup_indexes.sql',
  '017_update_superadmin_email.sql',
  '018_user_module_permissions.sql',
  '019_reemplazos_sucursal.sql',
  '020_notifications.sql',
  '021_facturas_pdf.sql',
  '022_pagos_detalles.sql',
  '023_limpieza_placeholders.sql',
  '024_workflows_closures_granular_roles.sql',
  '025_platform_expansion.sql',
  '026_external_storage_files.sql',
  '027_seed_essart.sql',
  '028_solicitudes_comprobantes.sql',
  '029_update_duenas.sql',
  '030_sanitize_audit_logs.sql',
  '031_solicitudes_datos_adicionales.sql',
  '032_sucursales_jefe_y_dispositivo_uuid.sql',
  '033_feriados_and_username.sql',
  '034_feriados_descripcion.sql',
  '035_vacaciones_saldo.sql',
  '036_solicitudes_flujo_dos_pasos.sql',
  '037_empresas_logo_branding.sql',
  '038_empleados_sucursales_autorizadas.sql',
  '039_marcaciones_almuerzo_tipos.sql',
  '040_reglas_laborales_empresa.sql',
  '041_production_performance_indexes.sql',
  '042_seed_simulation.js',
  '043_vacaciones_ajustes.sql',
  '044_fix_essart_june_timezone_lunch.js',
  '045_zkteco_biometric_sync.sql',
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Crear tabla de control de versiones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        ejecutado_en TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Consultar qué migraciones ya fueron aplicadas
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(rows.map(r => r.version));

    for (const migration of migrations) {
      if (appliedVersions.has(migration)) {
        console.log(`Skipping applied migration: ${migration}`);
        continue;
      }

      const filePath = path.join(__dirname, migration);

      if (migration.endsWith('.js')) {
        console.log(`Running pending JS migration: ${migration}`);
        const runMigrationFn = require(filePath);
        await runMigrationFn(client);
      } else {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Running pending SQL migration: ${migration}`);
        await client.query(sql);
      }

      // Registrar la migración como aplicada
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration]);
    }

    await client.query('COMMIT');
    console.log('Database migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
