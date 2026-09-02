const { createHash } = require('node:crypto');
const { z } = require('zod');
const { pool } = require('../config/database');
const { assertPeriodoAbierto } = require('./laboral.service');

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
const importSchema = z.object({ referencia: z.string().regex(/^[a-f0-9]{64}$/), empleado_id: z.uuid(),
  tipo: z.enum(['entrada', 'salida_almuerzo', 'entrada_almuerzo', 'salida']), confirmado: z.literal(true) }).strict();
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
  const result = await db.query(`SELECT d.*, s.nombre AS sucursal_nombre, s.estado AS sucursal_estado, i.configuracion
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
  const rows = await db.query(`SELECT b.referencia, b.dispositivo_usuario_id,
    to_char(b.fecha_hora_local,'YYYY-MM-DD HH24:MI:SS') AS fecha_hora_local,
    b.estado_dispositivo, b.verificacion, b.origen, b.recibido_en,
    m.id AS marcacion_id, m.tipo, m.estado AS estado_marcacion, m.anulada,
    m.empleado_id, concat_ws(' ',e.nombres,e.apellidos) AS empleado_nombre
    FROM biometrico_eventos b
    LEFT JOIN marcaciones m ON m.empresa_id=b.empresa_id AND m.integracion_id=b.integracion_id AND m.origen_referencia=b.referencia
    LEFT JOIN empleados e ON e.empresa_id=m.empresa_id AND e.id=m.empleado_id
    WHERE b.empresa_id=$1 AND b.integracion_id=$2
    AND b.fecha_hora_local >= $3::date AND b.fecha_hora_local < $3::date+interval '1 day'
    ORDER BY b.fecha_hora_local DESC, b.referencia LIMIT 50 OFFSET $4`, [...values, (pagina - 1) * 50]);
  const employees = await db.query(`SELECT id,codigo,nombres,apellidos FROM empleados
    WHERE empresa_id=$1 AND estado='activo' ORDER BY apellidos,nombres,id`, [empresaId]);
  return { dispositivo: { serial: device.serial, sucursal_id: device.sucursal_id, sucursal_nombre: device.sucursal_nombre },
    items: rows.rows, empleados: employees.rows, vinculos: device.configuracion?.adms_usuarios_mapeo || {},
    total: count.rows[0].total, pagina, fecha, recepcion_publica: 'bloqueada', importacion_asistencia: 'manual_individual' };
}

// Solo importa un evento almacenado, con identidad y tipo confirmados por un administrador.
// No deduce el tipo a partir del estado del firmware ni consulta el reloj por TCP.
async function importEvent({ empresaId, usuarioId, id, body }, db = pool) {
  const input = parse(importSchema, body);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
    const device = await getDevice(client, empresaId, id, true);
    if (!device) fail('Biometrico activo no encontrado', 404);
    if (device.sucursal_estado !== 'activa') fail('La sucursal del equipo esta inactiva', 409);
    const events = await client.query(`SELECT dispositivo_usuario_id,
      to_char(fecha_hora_local,'YYYY-MM-DD HH24:MI:SS') AS local_time
      FROM biometrico_eventos WHERE empresa_id=$1 AND integracion_id=$2 AND referencia=$3 FOR UPDATE`,
    [empresaId, id, input.referencia]);
    const event = events.rows[0];
    if (!event) fail('Evento no encontrado en esta bandeja', 404);
    const employee = (await client.query(`SELECT id,codigo FROM empleados
      WHERE empresa_id=$1 AND id=$2 AND estado='activo' FOR UPDATE`, [empresaId, input.empleado_id])).rows[0];
    if (!employee) fail('Empleado activo no encontrado en esta empresa', 404);
    const mapped = device.configuracion?.adms_usuarios_mapeo || {};
    const legacy = device.configuracion?.usuarios_mapeo || {};
    if ((mapped[event.dispositivo_usuario_id] && mapped[event.dispositivo_usuario_id] !== employee.id)
      || (legacy[event.dispositivo_usuario_id] && String(legacy[event.dispositivo_usuario_id]).toUpperCase() !== employee.codigo.toUpperCase())
      || Object.entries(mapped).some(([key, value]) => key !== event.dispositivo_usuario_id && value === employee.id)
      || Object.entries(legacy).some(([key, value]) => key !== event.dispositivo_usuario_id && String(value).toUpperCase() === employee.codigo.toUpperCase())) {
      fail('Existe un vinculo distinto para este ID o empleado. No se reasigna el historial.', 409);
    }
    // El historial prevalece incluso si alguien edita la configuracion del dispositivo.
    const conflict = await client.query(`SELECT m.id FROM biometrico_eventos b JOIN marcaciones m
      ON m.empresa_id=b.empresa_id AND m.integracion_id=b.integracion_id AND m.origen_referencia=b.referencia
      WHERE b.empresa_id=$1 AND b.integracion_id=$2 AND
      ((b.dispositivo_usuario_id=$3 AND m.empleado_id<>$4) OR (b.dispositivo_usuario_id<>$3 AND m.empleado_id=$4)) LIMIT 1`,
    [empresaId, id, event.dispositivo_usuario_id, employee.id]);
    if (conflict.rows.length) fail('El historial contiene un vinculo distinto. Requiere revision.', 409);
    const existing = (await client.query(`SELECT id,empleado_id,tipo,estado,anulada FROM marcaciones
      WHERE empresa_id=$1 AND integracion_id=$2 AND origen_referencia=$3 FOR UPDATE`, [empresaId, id, input.referencia])).rows[0];
    if (existing) {
      if (existing.empleado_id !== employee.id || existing.tipo !== input.tipo || existing.anulada || existing.estado === 'rechazada') {
        fail('El evento ya tiene una marcacion distinta, anulada o rechazada. No se sobrescribe.', 409);
      }
      await client.query('COMMIT');
      return { marcacion_id: existing.id, nueva: false, tipo: existing.tipo };
    }
    const timestamp = event.local_time.replace(' ', 'T') + '-05:00';
    // Impide que un cierre se escriba entre la comprobacion y esta importacion breve.
    await client.query('LOCK TABLE cierres_mensuales IN SHARE MODE');
    await assertPeriodoAbierto(empresaId, timestamp, client);
    // Serializa con cualquier otra via de escritura, incluida la marcacion web.
    await client.query('LOCK TABLE marcaciones IN SHARE ROW EXCLUSIVE MODE');
    const duplicate = await client.query(`SELECT id FROM marcaciones WHERE empresa_id=$1 AND empleado_id=$2
      AND tipo=$3 AND estado<>'rechazada' AND anulada=FALSE
      AND marcado_en >= ($4::date::timestamp AT TIME ZONE 'America/Guayaquil')
      AND marcado_en < (($4::date+1)::timestamp AT TIME ZONE 'America/Guayaquil') LIMIT 1`,
    [empresaId, employee.id, input.tipo, event.local_time.slice(0, 10)]);
    if (duplicate.rows.length) fail('El empleado ya tiene una marcacion de este tipo en esa fecha', 409);
    const mark = await client.query(`INSERT INTO marcaciones
      (empresa_id,empleado_id,sucursal_id,tipo,estado,latitud,longitud,distancia_metros,dentro_geocerca,
       mensaje,marcado_en,origen,integracion_id,origen_referencia)
      VALUES($1,$2,$3,$4,'aceptada',0,0,0,TRUE,$5,$6::timestamptz,'biometrico',$7,$8) RETURNING id`,
    [empresaId, employee.id, device.sucursal_id, input.tipo,
      'Piloto ADMS: importacion manual individual; identidad y tipo confirmados por administrador. Sin geolocalizacion.', timestamp, id, input.referencia]);
    await client.query(`UPDATE integraciones_externas SET configuracion=configuracion || $3::jsonb,
      actualizado_por=$4,actualizado_en=now() WHERE empresa_id=$1 AND id=$2`,
    [empresaId, id, JSON.stringify({ adms_usuarios_mapeo: { ...mapped, [event.dispositivo_usuario_id]: employee.id } }), usuarioId]);
    await client.query(`INSERT INTO integracion_ejecuciones(integracion_id,empresa_id,ejecutado_por,accion,estado,resumen,errores)
      VALUES($1,$2,$3,'importar_evento_adms','ok',$4::jsonb,'[]'::jsonb)`,
    [id, empresaId, usuarioId, JSON.stringify({ referencia: input.referencia, dispositivo_usuario_id: event.dispositivo_usuario_id,
      empleado_id: employee.id, tipo: input.tipo, marcacion_id: mark.rows[0].id, origen: 'piloto_manual', importadas_asistencia: 1 })]);
    await client.query('COMMIT');
    return { marcacion_id: mark.rows[0].id, nueva: true, tipo: input.tipo };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
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

module.exports = { register, list, uploadPilot, importEvent, validLocalTime, uploadSchema, querySchema, registerSchema, importSchema };
