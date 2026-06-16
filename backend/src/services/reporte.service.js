const { pool } = require('../config/database');

const REPORT_TIME_ZONE = 'America/Guayaquil';

function buildDateRange({ fecha, fechaDesde, fechaHasta }) {
  if (fecha) {
    return {
      from: `${fecha} 00:00:00`,
      to: `${fecha} 23:59:59`,
    };
  }

  return {
    from: fechaDesde ? `${fechaDesde} 00:00:00` : null,
    to: fechaHasta ? `${fechaHasta} 23:59:59` : null,
  };
}

function applyDateFilters(filters, values, alias, range) {
  if (range.from) {
    values.push(range.from);
    filters.push(`(${alias}.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::date >= $${values.length}::date`);
  }

  if (range.to) {
    values.push(range.to);
    filters.push(`(${alias}.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::date <= $${values.length}::date`);
  }
}

async function asistenciaDiaria({ empresaId, fecha, sucursalId, empleadoId, estado }) {
  const filters = ['e.empresa_id = $1'];
  const values = [empresaId];

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`e.sucursal_habitual_id = $${values.length}`);
  }

  if (empleadoId) {
    values.push(empleadoId);
    filters.push(`e.id = $${values.length}`);
  }

  values.push(fecha);
  const dateParam = values.length;

  const result = await pool.query(
    `
      SELECT
        e.id AS empleado_id,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_habitual_nombre,
        MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END) AS primera_entrada,
        MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END) AS ultima_salida,
        CASE
          WHEN MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END)
             >= MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END)
          THEN FLOOR(EXTRACT(EPOCH FROM (
            MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END)
            - MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END)
          )) / 60)::int
          ELSE NULL
        END AS minutos_trabajados,
        CASE
          WHEN MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END)
             >= MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END)
          THEN ROUND((EXTRACT(EPOCH FROM (
            MAX(CASE WHEN m.tipo = 'salida' AND m.estado <> 'rechazada' THEN m.marcado_en END)
            - MIN(CASE WHEN m.tipo = 'entrada' AND m.estado <> 'rechazada' THEN m.marcado_en END)
          )) / 3600)::numeric, 2)
          ELSE NULL
        END AS horas_trabajadas,
        COUNT(m.id) FILTER (WHERE m.estado <> 'rechazada')::int AS marcaciones_validas,
        COUNT(m.id) FILTER (WHERE m.estado = 'aceptada_con_novedad')::int AS novedades,
        COUNT(m.id) FILTER (WHERE m.estado = 'rechazada')::int AS rechazadas,
        CASE
          WHEN COUNT(m.id) FILTER (WHERE m.estado <> 'rechazada') > 0 THEN 'presente'
          ELSE 'ausente'
        END AS estado_asistencia
      FROM empleados e
      LEFT JOIN sucursales s ON s.id = e.sucursal_habitual_id
      LEFT JOIN marcaciones m
        ON m.empleado_id = e.id
       AND m.empresa_id = e.empresa_id
       AND (m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::date = $${dateParam}::date
      WHERE ${filters.join(' AND ')}
        AND e.estado = 'activo'
      GROUP BY e.id, e.codigo, e.nombres, e.apellidos, s.nombre
      ORDER BY e.apellidos ASC, e.nombres ASC
    `,
    values,
  );

  const rows = estado ? result.rows.filter((row) => row.estado_asistencia === estado) : result.rows;

  return {
    fecha,
    resumen: {
      empleados: rows.length,
      presentes: rows.filter((row) => row.estado_asistencia === 'presente').length,
      ausentes: rows.filter((row) => row.estado_asistencia === 'ausente').length,
      novedades: rows.reduce((total, row) => total + Number(row.novedades || 0), 0),
      rechazadas: rows.reduce((total, row) => total + Number(row.rechazadas || 0), 0),
    },
    items: rows,
  };
}

async function entradasSalidas({ empresaId, fechaDesde, fechaHasta, sucursalId, empleadoId, limit = 500, offset = 0 }) {
  const filters = ['m.empresa_id = $1', "m.estado <> 'rechazada'"];
  const values = [empresaId];
  const range = buildDateRange({ fechaDesde, fechaHasta });

  applyDateFilters(filters, values, 'm', range);

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`m.sucursal_id = $${values.length}`);
  }

  if (empleadoId) {
    values.push(empleadoId);
    filters.push(`m.empleado_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        DATE(m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}') AS fecha,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        COALESCE(s_habitual.nombre, '-') AS sucursal_habitual_nombre,
        MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END) AS entrada,
        MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END) AS salida,
        COUNT(m.id) FILTER (WHERE m.tipo = 'entrada')::int AS total_entradas,
        COUNT(m.id) FILTER (WHERE m.tipo = 'salida')::int AS total_salidas,
        CASE
          WHEN MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END)
             >= MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END)
          THEN FLOOR(EXTRACT(EPOCH FROM (
            MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END)
            - MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END)
          )) / 60)::int
          ELSE NULL
        END AS minutos_trabajados,
        CASE
          WHEN MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END) IS NOT NULL
           AND MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END)
             >= MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END)
          THEN ROUND((EXTRACT(EPOCH FROM (
            MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END)
            - MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END)
          )) / 3600)::numeric, 2)
          ELSE NULL
        END AS horas_trabajadas,
        CASE
          WHEN MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END) IS NULL THEN 'sin_entrada'
          WHEN MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END) IS NULL THEN 'sin_salida'
          WHEN MAX(CASE WHEN m.tipo = 'salida' THEN m.marcado_en END)
            < MIN(CASE WHEN m.tipo = 'entrada' THEN m.marcado_en END) THEN 'inconsistente'
          ELSE 'completo'
        END AS estado_jornada,
        COUNT(*) OVER() AS total
      FROM marcaciones m
      INNER JOIN empleados e ON e.id = m.empleado_id
      LEFT JOIN sucursales s_habitual ON s_habitual.id = e.sucursal_habitual_id
      WHERE ${filters.join(' AND ')}
      GROUP BY DATE(m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}'), e.id, e.codigo, e.nombres, e.apellidos, s_habitual.nombre
      ORDER BY fecha DESC, e.apellidos ASC, e.nombres ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  const items = result.rows.map(({ total, ...row }) => row);

  return {
    items,
    total: Number(result.rows[0]?.total || 0),
    resumen: {
      jornadas: items.length,
      completas: items.filter((row) => row.estado_jornada === 'completo').length,
      sin_salida: items.filter((row) => row.estado_jornada === 'sin_salida').length,
      horas_trabajadas: Number(
        items.reduce((total, row) => total + Number(row.horas_trabajadas || 0), 0).toFixed(2),
      ),
    },
    limit,
    offset,
  };
}

async function asistenciaMensual({ empresaId, mes, sucursalId, empleadoId, estado }) {
  const filters = ['m.empresa_id = $1'];
  const values = [empresaId];

  values.push(`${mes}-01`);
  const monthParam = values.length;

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`m.sucursal_id = $${values.length}`);
  }

  if (empleadoId) {
    values.push(empleadoId);
    filters.push(`m.empleado_id = $${values.length}`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`m.estado = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        DATE(m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}') AS fecha,
        COUNT(DISTINCT m.empleado_id) FILTER (WHERE m.estado <> 'rechazada')::int AS empleados_presentes,
        COUNT(m.id) FILTER (WHERE m.estado = 'aceptada')::int AS aceptadas,
        COUNT(m.id) FILTER (WHERE m.estado = 'aceptada_con_novedad')::int AS novedades,
        COUNT(m.id) FILTER (WHERE m.estado = 'rechazada')::int AS rechazadas,
        COUNT(m.id)::int AS total_marcaciones
      FROM marcaciones m
      WHERE ${filters.join(' AND ')}
        AND (m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::date >= date_trunc('month', $${monthParam}::date)::date
        AND (m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::date < (date_trunc('month', $${monthParam}::date) + interval '1 month')::date
      GROUP BY DATE(m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')
      ORDER BY fecha ASC
    `,
    values,
  );

  return {
    mes,
    resumen: {
      dias_con_marcaciones: result.rows.length,
      total_marcaciones: result.rows.reduce((total, row) => total + Number(row.total_marcaciones || 0), 0),
      novedades: result.rows.reduce((total, row) => total + Number(row.novedades || 0), 0),
      rechazadas: result.rows.reduce((total, row) => total + Number(row.rechazadas || 0), 0),
    },
    items: result.rows,
  };
}

async function novedades({ empresaId, fechaDesde, fechaHasta, sucursalId, empleadoId, limit = 50, offset = 0 }) {
  const filters = ['m.empresa_id = $1', "m.estado = 'aceptada_con_novedad'"];
  const values = [empresaId];
  const range = buildDateRange({ fechaDesde, fechaHasta });

  applyDateFilters(filters, values, 'm', range);

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`m.sucursal_id = $${values.length}`);
  }

  if (empleadoId) {
    values.push(empleadoId);
    filters.push(`m.empleado_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        m.id,
        m.marcado_en,
        m.tipo,
        m.motivo_novedad,
        m.detalle_novedad,
        m.distancia_metros,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_nombre,
        COUNT(*) OVER() AS total
      FROM marcaciones m
      INNER JOIN empleados e ON e.id = m.empleado_id
      INNER JOIN sucursales s ON s.id = m.sucursal_id
      WHERE ${filters.join(' AND ')}
      ORDER BY m.marcado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...row }) => row),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function atrasos({ empresaId, fechaDesde, fechaHasta, sucursalId, empleadoId, limit = 50, offset = 0 }) {
  const filters = ['m.empresa_id = $1', "m.tipo = 'entrada'", "m.estado <> 'rechazada'", 'm.horario_id IS NOT NULL'];
  const values = [empresaId];
  const range = buildDateRange({ fechaDesde, fechaHasta });

  applyDateFilters(filters, values, 'm', range);

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`m.sucursal_id = $${values.length}`);
  }

  if (empleadoId) {
    values.push(empleadoId);
    filters.push(`m.empleado_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        m.id,
        m.marcado_en,
        m.distancia_metros,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_nombre,
        h.nombre AS horario_nombre,
        h.hora_inicio,
        h.tolerancia_minutos,
        FLOOR(
          EXTRACT(
            EPOCH FROM (
              (m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::time
              - (h.hora_inicio + (h.tolerancia_minutos || ' minutes')::interval)
            )
          ) / 60
        )::int AS minutos_atraso,
        COUNT(*) OVER() AS total
      FROM marcaciones m
      INNER JOIN empleados e ON e.id = m.empleado_id
      INNER JOIN sucursales s ON s.id = m.sucursal_id
      INNER JOIN horarios h ON h.id = m.horario_id
      WHERE ${filters.join(' AND ')}
        AND (m.marcado_en AT TIME ZONE '${REPORT_TIME_ZONE}')::time
          > (h.hora_inicio + (h.tolerancia_minutos || ' minutes')::interval)
      ORDER BY m.marcado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...row }) => row),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

module.exports = {
  asistenciaDiaria,
  asistenciaMensual,
  entradasSalidas,
  novedades,
  atrasos,
};
