const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { listMarcaciones } = require('../src/services/marcacion.service');

test('Historial incluye el dia completo en Ecuador, sin perder aislamiento ni filtros', async () => {
  let sql, params;
  const db = { query: async (query, values) => { sql = query; params = values; return { rows: [] }; } };
  await listMarcaciones({ empresaId: 'company', auth: { rol: 'ADMIN_EMPRESA' }, empleadoId: 'employee',
    fechaDesde: '2026-09-02', fechaHasta: '2026-09-02' }, db);
  assert.match(sql, /m\.empresa_id = \$1/);
  assert.match(sql, /m\.empleado_id = \$2/);
  assert.match(sql, /m\.marcado_en >= \(\$3::date::timestamp AT TIME ZONE 'America\/Guayaquil'\)/);
  assert.match(sql, /m\.marcado_en < \(\(\$4::date \+ 1\)::timestamp AT TIME ZONE 'America\/Guayaquil'\)/);
  assert.deepEqual(params, ['company', 'employee', '2026-09-02', '2026-09-02', 20, 0]);
});

test('PostgreSQL: misma fecha incluye medianoche y tarde, excluye dias vecinos y otra empresa', { skip: process.env.ADMS_DB_TEST !== 'true' }, async () => {
  require('../src/utils/env.util').loadBackendEnv();
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL;
  const host = url ? new URL(url).hostname : process.env.DB_HOST || 'localhost';
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(host), 'Solo base local');
  const db = new Pool(url ? { connectionString: url } : { host, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'asistepro', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || 'postgres' });
  const client = await db.connect();
  const schema = 'mark_dates_' + randomUUID().replaceAll('-', '');
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query(`CREATE TABLE empleados(id text,codigo text,nombres text,apellidos text,usuario_id text,empresa_id text);
      CREATE TABLE sucursales(id text,nombre text,empresa_id text); CREATE TABLE horarios(id text,nombre text);
      CREATE TABLE marcaciones(id text,empresa_id text,empleado_id text,sucursal_id text,horario_id text,marcado_en timestamptz,estado text,integracion_id text,origen_referencia text);
      CREATE TABLE biometrico_dispositivos(empresa_id text,integracion_id text,sucursal_id text);
      CREATE TABLE biometrico_eventos(empresa_id text,integracion_id text,referencia text,sincronizado_empleado_id text,fecha_hora_local timestamp,estado_dispositivo int,dispositivo_usuario_id text);
      INSERT INTO empleados VALUES('employee','EMP','Persona','Prueba','user','company');
      INSERT INTO sucursales VALUES('branch','Matriz','company');
      INSERT INTO marcaciones(id,empresa_id,empleado_id,sucursal_id,marcado_en) VALUES
        ('before','company','employee','branch','2026-09-01 23:59:59-05'),
        ('start','company','employee','branch','2026-09-02 00:00:00-05'),
        ('afternoon','company','employee','branch','2026-09-02 16:01:17-05'),
        ('end','company','employee','branch','2026-09-02 23:59:59.999-05'),
        ('after','company','employee','branch','2026-09-03 00:00:00-05'),
        ('foreign','other','employee','branch','2026-09-02 16:01:17-05');`);
    for (const zone of ['UTC', 'America/Guayaquil', 'Asia/Tokyo']) {
      await client.query('SELECT set_config($1,$2,true)', ['TimeZone', zone]);
      const result = await listMarcaciones({ empresaId: 'company', auth: { rol: 'ADMIN_EMPRESA' },
        fechaDesde: '2026-09-02', fechaHasta: '2026-09-02' }, client);
      assert.equal(result.total, 3);
      assert.deepEqual(result.items.map(item => item.id), ['end', 'afternoon', 'start']);
    }
  } finally { await client.query('ROLLBACK'); client.release(); await db.end(); }
});
