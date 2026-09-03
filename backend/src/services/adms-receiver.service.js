const { pool } = require('../config/database');

// SN sirve para ENRUTAR, no para autenticar. Este servicio solo escribe eventos
// no verificados en la bandeja privada. No tiene acceso a importar marcaciones.
async function findDevice(serial, db = pool) {
  const result = await db.query(`SELECT d.empresa_id,d.integracion_id FROM biometrico_dispositivos d
    JOIN integraciones_externas i ON i.empresa_id=d.empresa_id AND i.id=d.integracion_id
    JOIN sucursales s ON s.empresa_id=d.empresa_id AND s.id=d.sucursal_id
    WHERE d.serial=$1 AND d.recepcion_directa=TRUE AND i.estado='activa' AND i.tipo='biometrico' AND s.estado='activa'`, [serial]);
  return result.rows[0] || null;
}

async function contact(serial, db = pool) {
  const device = await findDevice(serial, db);
  if (!device) return false;
  // Throttle de telemetria. Ultimo contacto significa serie declarada, no identidad verificada.
  await db.query(`UPDATE biometrico_dispositivos SET ultimo_contacto_en=now()
    WHERE empresa_id=$1 AND integracion_id=$2 AND recepcion_directa=TRUE
    AND (ultimo_contacto_en IS NULL OR ultimo_contacto_en < now()-interval '25 seconds')`, [device.empresa_id, device.integracion_id]);
  return true;
}

async function accept(serial, records, db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='10s'");
    const device = await findDevice(serial, client);
    if (!device) throw new Error('disabled_device');
    const locked = await client.query(`SELECT integracion_id FROM biometrico_dispositivos
      WHERE empresa_id=$1 AND integracion_id=$2 AND recepcion_directa=TRUE FOR UPDATE`, [device.empresa_id, device.integracion_id]);
    if (!locked.rowCount) throw new Error('disabled_device');
    // Revalidar integracion/sucursal despues de adquirir el bloqueo.
    if (!await findDevice(serial, client)) throw new Error('disabled_device');
    const unique = [...new Map(records.map(record => [record.referencia, record])).values()];
    const inserted = await client.query(`INSERT INTO biometrico_eventos
      (empresa_id,integracion_id,referencia,dispositivo_usuario_id,fecha_hora_local,estado_dispositivo,verificacion,origen,adms_recibido_en)
      SELECT $1,$2,x.referencia,x."userId",x."localTime"::timestamp,x.status,x.verification,'adms_sin_verificar',now()
      FROM jsonb_to_recordset($3::jsonb) AS x(referencia text,"userId" text,"localTime" text,status smallint,verification smallint)
      ON CONFLICT(integracion_id,referencia) DO NOTHING`, [device.empresa_id, device.integracion_id, JSON.stringify(unique)]);
    const count = await client.query(`SELECT count(*)::int AS n FROM biometrico_eventos WHERE empresa_id=$1 AND integracion_id=$2`, [device.empresa_id, device.integracion_id]);
    if (count.rows[0].n > 250000) throw new Error('inbox_capacity');
    await client.query(`UPDATE biometrico_eventos SET adms_recibido_en=now()
      WHERE empresa_id=$1 AND integracion_id=$2 AND referencia=ANY($3::text[]) AND adms_recibido_en IS NULL`,
    [device.empresa_id, device.integracion_id, unique.map(record => record.referencia)]);
    await client.query(`UPDATE biometrico_dispositivos SET ultimo_contacto_en=now(),ultimo_lote_en=now(),
      ultimo_lote_registros=$3,ultimo_lote_nuevos=$4 WHERE empresa_id=$1 AND integracion_id=$2`,
    [device.empresa_id, device.integracion_id, records.length, inserted.rowCount]);
    await client.query('COMMIT'); // Solo despues se permite ACK al dispositivo.
    return { recibidas: records.length, nuevas: inserted.rowCount };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

module.exports = { findDevice, contact, accept };
