const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadBackendEnv } = require('../utils/env.util');

loadBackendEnv();

const databaseUrl = process.env.DATABASE_URL || [
  'postgresql://',
  encodeURIComponent(process.env.DB_USER || 'postgres'),
  ':',
  encodeURIComponent(process.env.DB_PASSWORD || 'postgres'),
  '@',
  process.env.DB_HOST || 'localhost',
  ':',
  process.env.DB_PORT || '5432',
  '/',
  process.env.DB_NAME || 'asistepro',
].join('');

const backupPath = path.join(os.tmpdir(), `asistepro-backup-${Date.now()}.dump`);
function resolvePostgresBinary(envPath, binaryName) {
  if (envPath) return envPath;
  if (process.platform !== 'win32') return binaryName;

  for (let version = 20; version >= 12; version -= 1) {
    const candidate = path.join('C:\\Program Files\\PostgreSQL', String(version), 'bin', `${binaryName}.exe`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return binaryName;
}

const pgDump = resolvePostgresBinary(process.env.PG_DUMP_PATH, 'pg_dump');
const pgRestore = resolvePostgresBinary(process.env.PG_RESTORE_PATH, 'pg_restore');

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} termino con codigo ${result.status}`);
  }
  return result.stdout;
}

try {
  run(pgDump, ['--format=custom', '--no-owner', '--no-privileges', '--file', backupPath, databaseUrl]);
  const backupStats = fs.statSync(backupPath);
  if (backupStats.size === 0) throw new Error('El backup generado esta vacio');

  const catalog = run(pgRestore, ['--list', backupPath]);
  const entries = catalog.split(/\r?\n/).filter((line) => line && !line.startsWith(';')).length;
  if (!entries) throw new Error('pg_restore no encontro objetos en el backup');

  console.log(JSON.stringify({ ok: true, bytes: backupStats.size, catalog_entries: entries }));
} catch (error) {
  console.error(`Verificacion de backup fallida: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(backupPath, { force: true });
}
