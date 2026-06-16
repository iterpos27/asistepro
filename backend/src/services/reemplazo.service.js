const { pool } = require('../config/database');

function buildOverlapClause(values, { empleadoId, sucursalId, fechaInicio, fechaFin, excludeId }) {
  values.push(empleadoId);
  const empleadoParam = values.length;
  values.push(sucursalId);
  const sucursalParam = values.length;
  values.push(fechaInicio);
  const fechaInicioParam = values.length;
  values.push(fechaFin);
  const fechaFinParam = values.length;

  let clause = `
    empleado_id = $${empleadoParam}
    AND sucursal_id = $${sucursalParam}
    AND estado = 'activo'
    AND fecha_inicio <= $${fechaFinParam}::date
    AND fecha_fin >= $${fechaInicioParam}::date
  `;

  if (excludeId) {
    values.push(excludeId);
    clause += ` AND id <> $${values.length}`;
  }

  return clause;
}

function toDateText(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function findEmpleadoInTenant(empresaId, empleadoId) {
  const result = await pool.query(
    `
      SELECT id, sucursal_habitual_id
      FROM empleados
      WHERE empresa_id = $1
        AND id = $2
        AND estado = 'activo'
      LIMIT 1
    `,
    [empresaId, empleadoId],
  );

  return result.rows[0] || null;
}

async function assertSucursalInTenant(empresaId, sucursalId) {
  const result = await pool.query(
    `
      SELECT id
      FROM sucursales
      WHERE empresa_id = $1
        AND id = $2
        AND estado = 'activa'
      LIMIT 1
    `,
    [empresaId, sucursalId],
  );

  return result.rows[0] || null;
}

async function assertCanSaveReemplazo(empresaId, payload, { excludeId } = {}) {
  const empleado = await findEmpleadoInTenant(empresaId, payload.empleado_id);
  if (!empleado) {
    const error = new Error('empleado_id no pertenece a la empresa o no esta activo');
    error.statusCode = 400;
    throw error;
  }

  const sucursal = await assertSucursalInTenant(empresaId, payload.sucursal_id);
  if (!sucursal) {
    const error = new Error('sucursal_id no pertenece a la empresa o no esta activa');
    error.statusCode = 400;
    throw error;
  }

  if (empleado.sucursal_habitual_id === payload.sucursal_id) {
    const error = new Error('La sucursal de reemplazo debe ser distinta a la sucursal habitual');
    error.statusCode = 400;
    throw error;
  }

  const values = [empresaId];
  const overlapClause = buildOverlapClause(values, {
    empleadoId: payload.empleado_id,
    sucursalId: payload.sucursal_id,
    fechaInicio: payload.fecha_inicio,
    fechaFin: payload.fecha_fin,
    excludeId,
  });
  const overlap = await pool.query(
    `
      SELECT id
      FROM reemplazos_sucursal
      WHERE empresa_id = $1
        AND ${overlapClause}
      LIMIT 1
    `,
    values,
  );

  if (overlap.rows.length) {
    const error = new Error('Ya existe un reemplazo activo para este empleado, sucursal y rango de fechas');
    error.statusCode = 409;
    throw error;
  }
}

async function listReemplazos({ empresaId, empleadoId, sucursalId, estado, fechaDesde, fechaHasta, search, limit = 20, offset = 0 }) {
  const filters = ['r.empresa_id = $1'];
  const values = [empresaId];

  if (empleadoId) {
    values.push(empleadoId);
    filters.push(`r.empleado_id = $${values.length}`);
  }

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`r.sucursal_id = $${values.length}`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`r.estado = $${values.length}`);
  }

  if (fechaDesde) {
    values.push(fechaDesde);
    filters.push(`r.fecha_fin >= $${values.length}::date`);
  }

  if (fechaHasta) {
    values.push(fechaHasta);
    filters.push(`r.fecha_inicio <= $${values.length}::date`);
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      LOWER(e.codigo) LIKE $${values.length}
      OR LOWER(e.nombres) LIKE $${values.length}
      OR LOWER(e.apellidos) LIKE $${values.length}
      OR LOWER(s.nombre) LIKE $${values.length}
      OR LOWER(r.motivo) LIKE $${values.length}
    )`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        r.*,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_nombre,
        u.email AS autorizado_por_email,
        COUNT(*) OVER() AS total
      FROM reemplazos_sucursal r
      INNER JOIN empleados e ON e.id = r.empleado_id
      INNER JOIN sucursales s ON s.id = r.sucursal_id
      LEFT JOIN usuarios u ON u.id = r.autorizado_por
      WHERE ${filters.join(' AND ')}
      ORDER BY r.fecha_inicio DESC, r.creado_en DESC
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

async function findReemplazoById(empresaId, id) {
  const result = await pool.query(
    `
      SELECT
        r.*,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_nombre,
        u.email AS autorizado_por_email
      FROM reemplazos_sucursal r
      INNER JOIN empleados e ON e.id = r.empleado_id
      INNER JOIN sucursales s ON s.id = r.sucursal_id
      LEFT JOIN usuarios u ON u.id = r.autorizado_por
      WHERE r.empresa_id = $1
        AND r.id = $2
      LIMIT 1
    `,
    [empresaId, id],
  );
  return result.rows[0] || null;
}

async function createReemplazo(empresaId, auth, payload) {
  await assertCanSaveReemplazo(empresaId, payload);

  const result = await pool.query(
    `
      INSERT INTO reemplazos_sucursal (
        empresa_id,
        empleado_id,
        sucursal_id,
        autorizado_por,
        fecha_inicio,
        fecha_fin,
        hora_inicio,
        hora_fin,
        motivo,
        observacion,
        estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'activo'))
      RETURNING id
    `,
    [
      empresaId,
      payload.empleado_id,
      payload.sucursal_id,
      auth?.usuario_id || null,
      payload.fecha_inicio,
      payload.fecha_fin,
      payload.hora_inicio || null,
      payload.hora_fin || null,
      payload.motivo.trim(),
      payload.observacion?.trim() || null,
      payload.estado || 'activo',
    ],
  );

  return findReemplazoById(empresaId, result.rows[0].id);
}

async function updateReemplazo(empresaId, id, payload) {
  const current = await findReemplazoById(empresaId, id);
  if (!current) return null;

  const next = {
    empleado_id: payload.empleado_id !== undefined ? payload.empleado_id : current.empleado_id,
    sucursal_id: payload.sucursal_id !== undefined ? payload.sucursal_id : current.sucursal_id,
    fecha_inicio: payload.fecha_inicio !== undefined ? payload.fecha_inicio : toDateText(current.fecha_inicio),
    fecha_fin: payload.fecha_fin !== undefined ? payload.fecha_fin : toDateText(current.fecha_fin),
    hora_inicio: payload.hora_inicio !== undefined ? payload.hora_inicio || null : current.hora_inicio,
    hora_fin: payload.hora_fin !== undefined ? payload.hora_fin || null : current.hora_fin,
    motivo: payload.motivo !== undefined ? payload.motivo.trim() : current.motivo,
    observacion: payload.observacion !== undefined ? payload.observacion?.trim() || null : current.observacion,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
  };

  if (next.estado === 'activo') {
    await assertCanSaveReemplazo(empresaId, next, { excludeId: id });
  }

  await pool.query(
    `
      UPDATE reemplazos_sucursal
      SET empleado_id = $3,
          sucursal_id = $4,
          fecha_inicio = $5,
          fecha_fin = $6,
          hora_inicio = $7,
          hora_fin = $8,
          motivo = $9,
          observacion = $10,
          estado = $11,
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
    `,
    [
      empresaId,
      id,
      next.empleado_id,
      next.sucursal_id,
      next.fecha_inicio,
      next.fecha_fin,
      next.hora_inicio,
      next.hora_fin,
      next.motivo,
      next.observacion,
      next.estado,
    ],
  );

  return findReemplazoById(empresaId, id);
}

async function cancelReemplazo(empresaId, id) {
  const result = await pool.query(
    `
      UPDATE reemplazos_sucursal
      SET estado = 'cancelado',
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
      RETURNING id
    `,
    [empresaId, id],
  );

  if (!result.rows.length) return null;
  return findReemplazoById(empresaId, id);
}

async function findActiveReemplazoForMarcacion({ empresaId, empleadoId, sucursalId, markedAt = new Date() }) {
  const result = await pool.query(
    `
      SELECT *
      FROM reemplazos_sucursal
      WHERE empresa_id = $1
        AND empleado_id = $2
        AND sucursal_id = $3
        AND estado = 'activo'
        AND fecha_inicio <= $4::date
        AND fecha_fin >= $4::date
        AND (hora_inicio IS NULL OR $4::time >= hora_inicio)
        AND (hora_fin IS NULL OR $4::time <= hora_fin)
      ORDER BY creado_en DESC
      LIMIT 1
    `,
    [empresaId, empleadoId, sucursalId, markedAt],
  );

  return result.rows[0] || null;
}

module.exports = {
  cancelReemplazo,
  createReemplazo,
  findActiveReemplazoForMarcacion,
  findReemplazoById,
  listReemplazos,
  updateReemplazo,
};
