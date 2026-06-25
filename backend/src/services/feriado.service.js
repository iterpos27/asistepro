const { pool } = require('../config/database');

async function listFeriados({ empresaId, activo, limit = 100, offset = 0 }) {
  const filters = ['empresa_id = $1'];
  const values = [empresaId];

  if (activo !== undefined) {
    values.push(activo === 'true');
    filters.push(`activo = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT *, COUNT(*) OVER() AS total
      FROM feriados
      WHERE ${filters.join(' AND ')}
      ORDER BY fecha DESC
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

async function findFeriadoById(empresaId, id) {
  const result = await pool.query(
    `SELECT * FROM feriados WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, id],
  );
  return result.rows[0] || null;
}

async function createFeriado(empresaId, payload) {
  // Check duplicates
  const existing = await pool.query(
    'SELECT id FROM feriados WHERE empresa_id = $1 AND fecha = $2 LIMIT 1',
    [empresaId, payload.fecha]
  );
  if (existing.rows.length) {
    const error = new Error('Ya existe un feriado registrado para esta fecha');
    error.statusCode = 409;
    throw error;
  }

  const result = await pool.query(
    `
      INSERT INTO feriados (empresa_id, nombre, fecha, activo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      empresaId,
      payload.nombre.trim(),
      payload.fecha,
      payload.activo !== undefined ? payload.activo : true,
    ],
  );

  return result.rows[0];
}

async function updateFeriado(empresaId, id, payload) {
  const current = await findFeriadoById(empresaId, id);
  if (!current) return null;

  if (payload.fecha && payload.fecha !== current.fecha.toISOString().slice(0, 10)) {
    const existing = await pool.query(
      'SELECT id FROM feriados WHERE empresa_id = $1 AND fecha = $2 AND id <> $3 LIMIT 1',
      [empresaId, payload.fecha, id]
    );
    if (existing.rows.length) {
      const error = new Error('Ya existe un feriado registrado para esta fecha');
      error.statusCode = 409;
      throw error;
    }
  }

  const next = {
    nombre: payload.nombre !== undefined ? payload.nombre.trim() : current.nombre,
    fecha: payload.fecha !== undefined ? payload.fecha : current.fecha,
    activo: payload.activo !== undefined ? payload.activo : current.activo,
  };

  const result = await pool.query(
    `
      UPDATE feriados
      SET nombre = $3,
          fecha = $4,
          activo = $5,
          actualizado_en = NOW()
      WHERE empresa_id = $1 AND id = $2
      RETURNING *
    `,
    [empresaId, id, next.nombre, next.fecha, next.activo],
  );

  return result.rows[0] || null;
}

async function deleteFeriado(empresaId, id) {
  const result = await pool.query(
    `DELETE FROM feriados WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    [empresaId, id],
  );
  return result.rows[0] || null;
}

module.exports = {
  listFeriados,
  findFeriadoById,
  createFeriado,
  updateFeriado,
  deleteFeriado,
};
