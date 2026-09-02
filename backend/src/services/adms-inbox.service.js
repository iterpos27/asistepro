const { createHash } = require('node:crypto');
const { z } = require('zod');
const { pool } = require('../config/database');

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}
const serialSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
function validLocalTime(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const d = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 19).replace('T', ' ') === value;
}
const recordSchema = z.object({
  userId: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
  localTime: z.string().refine(validLocalTime),
  status: z.number().int().min(0).max(999),
  verification: z.number().int().min(0).max(999),
}).strict();
const uploadSchema = z.object({ serial: serialSchema, payload: z.object({
  records: z.array(recordSchema).min(1).max(1000),
}).strict() }).strict();
const registerSchema = z.object({ serial: serialSchema, sucursal_id: z.uuid() }).strict();
const querySchema = z.object({
  fecha: z.string().refine(value => validLocalTime(value + ' 00:00:00')),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) fail('Datos ADMS invalidos. Revisa serie, fecha y registros del piloto.');
  return result.data;
}

async function getDevice(db, empresaId, id, lock = false) {
  const result = await db.query(`SELECT d.*, s.nombre AS sucursal_nombre
    FROM biometrico_dispositivos d
    JOIN sucursales s ON s.empresa_id=d.empresa_id AND s.id=d.sucursal_id
    JOIN integraciones_externas i ON i.empresa_id=d.empresa_id AND i.id=d.integracion_id
    WHERE d.empresa_id=$1 AND d.integracion_id=$2 AND i.tipo='biometrico' AND i.estado='activa'
    ${lock ? 'FOR UPDATE OF d, i' : ''}`, [empresaId, id]);
  return result.rows[0] || null;
}

async function register({ empresaId, usuarioId, id, body }, db = pool) {
  const input = parse(registerSchema, body);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const integration = await client.query(`SELECT id FROM integraciones_externas
      WHERE empresa_id=$1 AND id=$2 AND tipo='biometrico' AND estado='activa' FOR UPDATE`, [empresaId, id]);
    if (!integration.rows.length) fail('Biometrico activo no encontrado en esta empresa', 404);
    const branch = await client.query(`SELECT id FROM sucursales WHERE empresa_id=$1 AND id=$2 AND estado='activa' FOR SHARE`,
      [empresaId, input.sucursal_id]);
    if (!branch.rows.length) fail('Sucursal activa no encontrada en esta empresa', 404);
    const existing = await getDevice(client, empresaId, id, true);
    if (existing && (existing.serial !== input.serial || existing.sucursal_id !== input.sucursal_id)) {
      fail('La serie y sucursal registradas no se reasignan para proteger el historial', 409);
    }
    await client.query(`INSERT INTO biometrico_dispositivos(integracion_id,empresa_id,sucursal_id,serial,creado_por)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(integracion_id) DO NOTHING`,
    [id, empresaId, input.sucursal_id, input.serial, usuarioId]);
    // El scheduler TCP no debe intentar conectarse desde Render a una IP privada.
    await client.query(`UPDATE integraciones_externas SET configuracion= configuracion || $3::jsonb,
      actualizado_por=$4, actualizado_en=now() WHERE empresa_id=$1 AND id=$2`,
    [empresaId, id, JSON.stringify({ modo_conexion: 'adms', sucursal_id: input.sucursal_id }), usuarioId]);
    await client.query('COMMIT');
    return { registrado: true, recepcion_publica: 'bloqueada', importacion_asistencia: false };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') fail('No se pudo registrar esta serie. Revisa su asignacion.', 409);
    throw error;
  } finally { client.release(); }
}

async function list({ empresaId, id, query }, db = pool) {
  const { fecha, pagina } = parse(querySchema, query);
  const integration = await db.query('SELECT id FROM integraciones_externas WHERE empresa_id=$1 AND id=$2 AND tipo=$3', [empresaId, id, 'biometrico']);
  if (!integration.rows.length) fail('Biometrico no encontrado', 404);
  const device = await getDevice(db, empresaId, id);
  if (!device) return { dispositivo: null, items: [], total: 0, pagina, fecha, recepcion_publica: 'bloqueada' };
  const values = [empresaId, id, fecha];
  const count = await db.query(`SELECT count(*)::int AS total FROM biometrico_eventos
    WHERE empresa_id=$1 AND integracion_id=$2 AND fecha_hora_local >= $3::date AND fecha_hora_local < $3::date+interval '1 day'`, values);
  const rows = await db.query(`SELECT referencia, dispositivo_usuario_id,
    to_char(fecha_hora_local,'YYYY-MM-DD HH24:MI:SS') AS fecha_hora_local,
    estado_dispositivo, verificacion, origen, recibido_en
    FROM biometrico_eventos WHERE empresa_id=$1 AND integracion_id=$2
    AND fecha_hora_local >= $3::date AND fecha_hora_local < $3::date+interval '1 day'
    ORDER BY fecha_hora_local DESC, referencia LIMIT 50 OFFSET $4`, [...values, (pagina - 1) * 50]);
  return { dispositivo: { serial: device.serial, sucursal_id: device.sucursal_id, sucursal_nombre: device.sucursal_nombre },
    items: rows.rows, total: count.rows[0].total, pagina, fecha, recepcion_publica: 'bloqueada', importacion_asistencia: false };
}

async function uploadPilot({ empresaId, usuarioId, id, body }, db = pool) {
  const input = parse(uploadSchema, body);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const device = await getDevice(client, empresaId, id, true);
    if (!device || device.serial !== input.serial) fail('La serie del archivo no corresponde a este dispositivo registrado', 409);
    const records = input.payload.records.map(r => ({ ...r,
      referencia: createHash('sha256').update(`${device.serial}|${r.userId}|${r.localTime}|${r.status}|${r.verification}`).digest('hex') }));
    const inserted = await client.query(`INSERT INTO biometrico_eventos
      (empresa_id,integracion_id,referencia,dispositivo_usuario_id,fecha_hora_local,estado_dispositivo,verificacion,origen,recibido_por)
      SELECT $1,$2,x.referencia,x."userId",x."localTime"::timestamp,x.status,x.verification,'piloto_manual',$4
      FROM jsonb_to_recordset($3::jsonb) AS x(referencia text,"userId" text,"localTime" text,status smallint,verification smallint)
      ON CONFLICT(integracion_id,referencia) DO NOTHING`, [empresaId, id, JSON.stringify(records), usuarioId]);
    await client.query(`INSERT INTO integracion_ejecuciones(integracion_id,empresa_id,ejecutado_por,accion,estado,resumen,errores)
      VALUES($1,$2,$3,'cargar_piloto_adms','ok',$4::jsonb,'[]'::jsonb)`,
    [id, empresaId, usuarioId, JSON.stringify({ recibidas: records.length, nuevas: inserted.rowCount, importadas_asistencia: 0 })]);
    await client.query('COMMIT');
    return { recibidas: records.length, nuevas: inserted.rowCount, duplicadas: records.length - inserted.rowCount, importadas_asistencia: 0 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

module.exports = { register, list, uploadPilot, validLocalTime, uploadSchema, querySchema, registerSchema };
