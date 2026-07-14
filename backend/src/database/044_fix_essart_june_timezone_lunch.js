const TIME_ZONE = 'America/Guayaquil';

module.exports = async function fixEssartJuneTimezoneLunch(client) {
  const companyResult = await client.query(
    "SELECT id FROM empresas WHERE UPPER(nombre) = 'ESSART S.A.' LIMIT 1",
  );

  if (!companyResult.rows.length) {
    console.log('ESSART S.A. no existe; se omite la corrección de junio.');
    return;
  }

  const empresaId = companyResult.rows[0].id;

  // The original seed sent timestamps without an offset. In production PostgreSQL
  // interpreted 08:00 as UTC and reports displayed it as 03:00 in Ecuador. Only
  // days with that exact erroneous entry pattern are shifted, keeping this
  // migration safe for fresh databases already seeded with explicit -05:00.
  const timezoneFix = await client.query(
    `WITH affected_days AS (
       SELECT DISTINCT
         empleado_id,
         (marcado_en AT TIME ZONE $2)::date AS fecha_local
       FROM marcaciones
       WHERE empresa_id = $1
         AND anulada = FALSE
         AND tipo = 'entrada'
         AND (marcado_en AT TIME ZONE $2)::date BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'
         AND (marcado_en AT TIME ZONE $2)::time >= TIME '03:00'
         AND (marcado_en AT TIME ZONE $2)::time < TIME '04:00'
     )
     UPDATE marcaciones m
     SET marcado_en = m.marcado_en + INTERVAL '5 hours'
     FROM affected_days d
     WHERE m.empresa_id = $1
       AND m.empleado_id = d.empleado_id
       AND (m.marcado_en AT TIME ZONE $2)::date = d.fecha_local
     RETURNING m.id`,
    [empresaId, TIME_ZONE],
  );

  const lunchInsert = await client.query(
    `WITH complete_days AS (
       SELECT DISTINCT ON (m.empleado_id, (m.marcado_en AT TIME ZONE $2)::date)
         m.empresa_id,
         m.empleado_id,
         m.sucursal_id,
         m.horario_id,
         m.latitud,
         m.longitud,
         m.distancia_metros,
         m.dentro_geocerca,
         m.origen,
         (m.marcado_en AT TIME ZONE $2)::date AS fecha_local
       FROM marcaciones m
       WHERE m.empresa_id = $1
         AND m.anulada = FALSE
         AND m.estado <> 'rechazada'
         AND m.tipo = 'entrada'
         AND (m.marcado_en AT TIME ZONE $2)::date BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'
         AND EXISTS (
           SELECT 1
           FROM marcaciones exit_mark
           WHERE exit_mark.empresa_id = m.empresa_id
             AND exit_mark.empleado_id = m.empleado_id
             AND exit_mark.anulada = FALSE
             AND exit_mark.estado <> 'rechazada'
             AND exit_mark.tipo = 'salida'
             AND (exit_mark.marcado_en AT TIME ZONE $2)::date = (m.marcado_en AT TIME ZONE $2)::date
         )
       ORDER BY m.empleado_id, (m.marcado_en AT TIME ZONE $2)::date, m.marcado_en
     ), lunch_types AS (
       SELECT 'salida_almuerzo'::varchar AS tipo, TIME '12:00' AS hora
       UNION ALL
       SELECT 'entrada_almuerzo'::varchar AS tipo, TIME '13:00' AS hora
     )
     INSERT INTO marcaciones (
       empresa_id, empleado_id, sucursal_id, horario_id, tipo, estado,
       latitud, longitud, distancia_metros, dentro_geocerca, marcado_en,
       motivo_novedad, detalle_novedad, anulada, origen
     )
     SELECT
       d.empresa_id,
       d.empleado_id,
       d.sucursal_id,
       d.horario_id,
       lunch.tipo,
       'aceptada',
       d.latitud,
       d.longitud,
       d.distancia_metros,
       d.dentro_geocerca,
       (d.fecha_local + lunch.hora) AT TIME ZONE $2,
       NULL,
       NULL,
       FALSE,
       d.origen
     FROM complete_days d
     CROSS JOIN lunch_types lunch
     WHERE NOT EXISTS (
       SELECT 1
       FROM marcaciones existing
       WHERE existing.empresa_id = d.empresa_id
         AND existing.empleado_id = d.empleado_id
         AND existing.tipo = lunch.tipo
         AND existing.anulada = FALSE
         AND (existing.marcado_en AT TIME ZONE $2)::date = d.fecha_local
     )
     RETURNING id`,
    [empresaId, TIME_ZONE],
  );

  console.log(`Corrección Essart junio: ${timezoneFix.rowCount} horas ajustadas y ${lunchInsert.rowCount} marcaciones de almuerzo creadas.`);
};
