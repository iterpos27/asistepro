require('dotenv').config({ path: 'backend/.env' });

const fs = require('fs');
const path = require('path');
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
];

async function runMigrations() {
  for (const migration of migrations) {
    const filePath = path.join(__dirname, migration);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Running ${migration}`);
    await pool.query(sql);
  }

  console.log('Database migrations completed');
}

runMigrations()
  .catch((error) => {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
