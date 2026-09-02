const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validLocalTime, uploadSchema, registerSchema, querySchema, importSchema } = require('../src/services/adms-inbox.service');
const { sanitizeValue } = require('../src/middlewares/audit.middleware');
const record = { userId: '4', localTime: '2026-09-02 16:01:17', status: 4, verification: 1 };

test('valida registros, fechas reales y limites; no admite huellas ni datos laborales', () => {
  assert.equal(validLocalTime(record.localTime), true);
  assert.equal(validLocalTime('2026-02-30 16:01:17'), false);
  assert.equal(uploadSchema.safeParse({ serial: 'TEST', payload: { records: [record] } }).success, true);
  for (const records of [[], Array(1001).fill(record), [{ ...record, status: -1 }], [{ ...record, template: 'secret' }], [{ ...record, status: '4' }]]) {
    assert.equal(uploadSchema.safeParse({ serial: 'TEST', payload: { records } }).success, false);
  }
  assert.equal(registerSchema.safeParse({ serial: 'X\nY', sucursal_id: randomUUID() }).success, false);
  assert.equal(querySchema.safeParse({ fecha: '2026-02-30' }).success, false);
  assert.equal(querySchema.safeParse({ fecha: '2026-09-02', pagina: '0' }).success, false);
  const request = { referencia: 'a'.repeat(64), empleado_id: randomUUID(), tipo: 'salida', confirmado: true };
  assert.equal(importSchema.safeParse(request).success, true);
  for (const invalid of [{ ...request, confirmado: false }, { ...request, tipo: '4' }, { ...request, fecha: '2026-09-02' }, { ...request, empresa_id: randomUUID() }]) {
    assert.equal(importSchema.safeParse(invalid).success, false);
  }
  assert.deepEqual(sanitizeValue({ serial: 'TEST', payload: { records: [record] } }), { serial: 'TEST', payload: '[redacted]' });
});

test('PostgreSQL: registro, aislamiento, deduplicacion, rollback y RLS', { skip: process.env.ADMS_DB_TEST !== 'true' }, async () => {
  require('../src/utils/env.util').loadBackendEnv();
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL;
  const host = url ? new URL(url).hostname : process.env.DB_HOST || 'localhost';
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(host), 'La prueba solo permite PostgreSQL local');
  const testPool = new Pool(url ? { connectionString: url } : { host, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'asistepro', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || 'postgres' });
  const client = await testPool.connect();
  const schema = 'adms_test_' + randomUUID().replaceAll('-', '');
  const company = randomUUID(), other = randomUUID(), branch = randomUUID(), otherBranch = randomUUID();
  const id = randomUUID(), otherId = randomUUID(), actor = randomUUID();
  let failAudit = false;
  const scoped = { query: (sql, values) => {
    if (sql === 'BEGIN') return client.query('SAVEPOINT request_tx');
    if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT request_tx');
    if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT request_tx');
    if (failAudit && sql.includes('INSERT INTO integracion_ejecuciones')) throw new Error('simulated audit failure');
    return client.query(sql, values);
  }, release() {} };
  const db = { ...scoped, connect: async () => scoped };
  const service = require('../src/services/adms-inbox.service');
  const args = { empresaId: company, usuarioId: actor, id };
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query(`CREATE TABLE usuarios(id uuid PRIMARY KEY);
      CREATE TABLE sucursales(id uuid PRIMARY KEY,empresa_id uuid,estado text,nombre text);
      CREATE TABLE integraciones_externas(id uuid PRIMARY KEY,empresa_id uuid,tipo text,estado text,
        configuracion jsonb DEFAULT '{}',actualizado_por uuid,actualizado_en timestamptz);
      CREATE TABLE integracion_ejecuciones(integracion_id uuid,empresa_id uuid,ejecutado_por uuid,accion text,estado text,resumen jsonb,errores jsonb);`);
    await client.query(`CREATE TABLE empleados(id uuid PRIMARY KEY,empresa_id uuid,codigo text,nombres text,apellidos text,estado text);
      CREATE TABLE cierres_mensuales(id uuid DEFAULT gen_random_uuid(),empresa_id uuid,mes text,estado text);
      CREATE TABLE marcaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid,empleado_id uuid,sucursal_id uuid,
        tipo text,estado text,anulada boolean DEFAULT false,latitud numeric,longitud numeric,distancia_metros numeric,dentro_geocerca boolean,
        mensaje text,marcado_en timestamptz,origen text,integracion_id uuid,origen_referencia varchar(64));
      CREATE UNIQUE INDEX test_marcacion_ref ON marcaciones(integracion_id,origen_referencia)
        WHERE integracion_id IS NOT NULL AND origen_referencia IS NOT NULL;`);
    await require('../src/database/046_adms_inbox')(client);
    await require('../src/database/046_adms_inbox')(client); // migration retry
    await client.query('INSERT INTO usuarios VALUES($1)', [actor]);
    await client.query("INSERT INTO sucursales VALUES($1,$2,'activa','MATRIZ'),($3,$4,'activa','OTRA')", [branch, company, otherBranch, other]);
    await client.query("INSERT INTO integraciones_externas(id,empresa_id,tipo,estado) VALUES($1,$2,'biometrico','activa'),($3,$4,'biometrico','activa')", [id, company, otherId, other]);
    await assert.rejects(service.register({ ...args, body: { serial: 'TEST', sucursal_id: otherBranch } }, db), /Sucursal activa/);
    await assert.rejects(service.register({ ...args, empresaId: other, body: { serial: 'TEST', sucursal_id: branch } }, db), /Biometrico activo/);
    await service.register({ ...args, body: { serial: 'TEST', sucursal_id: branch } }, db);
    await service.register({ ...args, body: { serial: 'TEST', sucursal_id: branch } }, db);
    await assert.rejects(service.register({ ...args, body: { serial: 'CHANGED', sucursal_id: branch } }, db), /no se reasignan/);
    await assert.rejects(service.register({ ...args, id: otherId, empresaId: other, body: { serial: 'TEST', sucursal_id: otherBranch } }, db), /No se pudo registrar/);
    await assert.rejects(service.uploadPilot({ ...args, body: { serial: 'WRONG', payload: { records: [record] } } }, db), /serie del archivo/);
    const body = { serial: 'TEST', payload: { records: [record, record] } };
    const first = await service.uploadPilot({ ...args, body }, db);
    assert.equal(first.nuevas, 1); assert.equal(first.duplicadas, 1); assert.equal(first.importadas_asistencia, 0);
    assert.equal((await service.uploadPilot({ ...args, body }, db)).nuevas, 0);
    failAudit = true;
    await assert.rejects(service.uploadPilot({ ...args, body: { serial: 'TEST', payload: { records: [{ ...record, userId: '52' }] } } }, db), /simulated/);
    failAudit = false;
    const inbox = await service.list({ ...args, query: { fecha: '2026-09-02' } }, db);
    assert.equal(inbox.total, 1); assert.equal(inbox.items[0].fecha_hora_local, record.localTime);
    assert.equal(inbox.items[0].origen, 'piloto_manual'); assert.equal(inbox.recepcion_publica, 'bloqueada');
    assert.equal((await service.list({ ...args, query: { fecha: '2026-09-03' } }, db)).total, 0);
    await assert.rejects(service.list({ ...args, empresaId: other, query: { fecha: '2026-09-02' } }, db), /no encontrado/);
    const security = await client.query(`SELECT relname,relrowsecurity,
      NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE grantee=0) AS no_public_grant
      FROM pg_class c WHERE relnamespace=$1::regnamespace AND relname IN ('biometrico_eventos','biometrico_dispositivos')`, [schema]);
    assert.equal(security.rows.length, 2);
    for (const r of security.rows) { assert.equal(r.relrowsecurity, true); assert.equal(r.no_public_grant, true); }
    // Comprobar FK compuesta: otro tenant no puede adjuntar eventos al dispositivo.
    await client.query('SAVEPOINT cross_tenant');
    await assert.rejects(client.query(`INSERT INTO biometrico_eventos
      SELECT $1,integracion_id,repeat('a',64),dispositivo_usuario_id,fecha_hora_local,estado_dispositivo,verificacion,origen,recibido_por,recibido_en
      FROM biometrico_eventos`, [other]), error => error.code === '23503');
    await client.query('ROLLBACK TO SAVEPOINT cross_tenant');
    const employee = randomUUID(), foreignEmployee = randomUUID(), inactive = randomUUID();
    await client.query(`INSERT INTO empleados VALUES($1,$2,'EMP-1','Persona','Prueba','activo'),
      ($3,$4,'EMP-2','Otra','Empresa','activo'),($5,$2,'EMP-3','Persona','Inactiva','inactivo')`,
    [employee, company, foreignEmployee, other, inactive]);
    const request = { ...args, body: { referencia: inbox.items[0].referencia, empleado_id: employee, tipo: 'salida', confirmado: true } };
    await assert.rejects(service.importEvent({ ...request, empresaId: other }, db), /no encontrado/);
    await assert.rejects(service.importEvent({ ...request, body: { ...request.body, referencia: 'f'.repeat(64) } }, db), /Evento no encontrado/);
    for (const empleado_id of [foreignEmployee, inactive]) {
      await assert.rejects(service.importEvent({ ...request, body: { ...request.body, empleado_id } }, db), /Empleado activo/);
    }
    await client.query("INSERT INTO cierres_mensuales(empresa_id,mes,estado) VALUES($1,'2026-09','cerrado')", [company]);
    await assert.rejects(service.importEvent(request, db), /periodo mensual esta cerrado/);
    await client.query("UPDATE cierres_mensuales SET estado='reabierto'");
    failAudit = true;
    await assert.rejects(service.importEvent(request, db), /simulated/);
    failAudit = false;
    assert.equal((await client.query('SELECT count(*)::int AS n FROM marcaciones')).rows[0].n, 0);
    assert.equal((await client.query('SELECT configuracion FROM integraciones_externas WHERE id=$1', [id])).rows[0].configuracion.adms_usuarios_mapeo, undefined);
    const imported = await service.importEvent(request, db);
    assert.equal(imported.nueva, true);
    const saved = (await client.query('SELECT * FROM marcaciones WHERE id=$1', [imported.marcacion_id])).rows[0];
    assert.equal(saved.empleado_id, employee); assert.equal(saved.sucursal_id, branch);
    assert.equal(saved.marcado_en.toISOString(), '2026-09-02T21:01:17.000Z');
    assert.equal(saved.tipo, 'salida'); assert.equal(saved.origen, 'biometrico');
    assert.equal((await service.importEvent(request, db)).nueva, false);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM marcaciones')).rows[0].n, 1);
    const updatedInbox = await service.list({ ...args, query: { fecha: '2026-09-02' } }, db);
    assert.equal(updatedInbox.items[0].marcacion_id, imported.marcacion_id);
    assert.equal(updatedInbox.vinculos['4'], employee);
    assert.equal(updatedInbox.empleados.length, 1);
    await assert.rejects(service.importEvent({ ...request, body: { ...request.body, tipo: 'entrada' } }, db), /ya tiene una marcacion distinta/);
    // Otro evento con la misma salida no duplica la asistencia.
    await service.uploadPilot({ ...args, body: { serial: 'TEST', payload: { records: [{ ...record, localTime: '2026-09-02 16:02:00' }] } } }, db);
    const second = (await service.list({ ...args, query: { fecha: '2026-09-02' } }, db)).items.find(r => !r.marcacion_id);
    await assert.rejects(service.importEvent({ ...request, body: { ...request.body, referencia: second.referencia } }, db), /ya tiene una marcacion de este tipo/);
    // No reasigna ID ni revive registros anulados.
    await client.query("UPDATE empleados SET estado='activo' WHERE id=$1", [inactive]);
    await assert.rejects(service.importEvent({ ...request, body: { ...request.body, empleado_id: inactive } }, db), /vinculo distinto/);
    await client.query('UPDATE marcaciones SET anulada=true WHERE id=$1', [imported.marcacion_id]);
    await assert.rejects(service.importEvent(request, db), /anulada o rechazada/);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM integracion_ejecuciones WHERE accion='importar_evento_adms'")).rows[0].n, 1);
  } finally {
    await client.query('ROLLBACK'); // esquema y fixtures no persisten
    client.release(); await testPool.end();
  }
});

test('archivo piloto: selecciona solo el dia y no envia plantillas, claves ni otras fechas', async () => {
  const { preparePilotFile } = await import('../../frontend/src/pages/integraciones/adms-pilot-file.js');
  const saved = { version: 1, serial: 'TEST', records: { a: { ...record, id: 'ignored', template: 'never send' },
    b: { ...record, localTime: '2026-09-01 16:00:00' } } };
  assert.deepEqual(preparePilotFile(JSON.stringify(saved), 'TEST', '2026-09-02'), { serial: 'TEST', payload: { records: [record] } });
  assert.throws(() => preparePilotFile(JSON.stringify(saved), 'OTHER', '2026-09-02'), /serie/);
  assert.throws(() => preparePilotFile(JSON.stringify(saved), 'TEST', '2026-09-03'), /no contiene/);
});
