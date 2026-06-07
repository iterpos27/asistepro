const { pool } = require('../config/database');

function validatePlanPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.codigo !== undefined) {
    if (!payload.codigo?.trim()) errors.push('codigo es requerido');
  }

  if (!partial || payload.nombre !== undefined) {
    if (!payload.nombre?.trim()) errors.push('nombre es requerido');
  }

  if (payload.precio_mensual !== undefined && Number(payload.precio_mensual) < 0) {
    errors.push('precio_mensual no puede ser negativo');
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

function normalizePlanPayload(payload) {
  return {
    codigo: payload.codigo?.trim().toLowerCase(),
    nombre: payload.nombre?.trim(),
    descripcion: payload.descripcion?.trim() || null,
    precio_mensual: Number(payload.precio_mensual || 0),
    limite_empleados: payload.limite_empleados ?? null,
    limite_sucursales: payload.limite_sucursales ?? null,
    activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
  };
}

async function listPlanes({ incluirInactivos = false } = {}) {
  const result = await pool.query(
    `
      SELECT *
      FROM planes
      WHERE ($1::boolean = TRUE OR activo = TRUE)
      ORDER BY precio_mensual ASC, nombre ASC
    `,
    [incluirInactivos],
  );

  return result.rows;
}

async function findPlanById(id) {
  const result = await pool.query('SELECT * FROM planes WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

async function createPlan(payload) {
  validatePlanPayload(payload);
  const plan = normalizePlanPayload(payload);

  const result = await pool.query(
    `
      INSERT INTO planes (
        codigo,
        nombre,
        descripcion,
        precio_mensual,
        limite_empleados,
        limite_sucursales,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      plan.codigo,
      plan.nombre,
      plan.descripcion,
      plan.precio_mensual,
      plan.limite_empleados,
      plan.limite_sucursales,
      plan.activo,
    ],
  );

  return result.rows[0];
}

async function updatePlan(id, payload) {
  validatePlanPayload(payload, { partial: true });
  const current = await findPlanById(id);

  if (!current) return null;

  const next = {
    codigo: payload.codigo !== undefined ? payload.codigo.trim().toLowerCase() : current.codigo,
    nombre: payload.nombre !== undefined ? payload.nombre.trim() : current.nombre,
    descripcion: payload.descripcion !== undefined ? payload.descripcion?.trim() || null : current.descripcion,
    precio_mensual:
      payload.precio_mensual !== undefined ? Number(payload.precio_mensual) : Number(current.precio_mensual),
    limite_empleados:
      payload.limite_empleados !== undefined ? payload.limite_empleados : current.limite_empleados,
    limite_sucursales:
      payload.limite_sucursales !== undefined ? payload.limite_sucursales : current.limite_sucursales,
    activo: payload.activo !== undefined ? Boolean(payload.activo) : current.activo,
  };

  const result = await pool.query(
    `
      UPDATE planes
      SET codigo = $2,
          nombre = $3,
          descripcion = $4,
          precio_mensual = $5,
          limite_empleados = $6,
          limite_sucursales = $7,
          activo = $8,
          actualizado_en = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      next.codigo,
      next.nombre,
      next.descripcion,
      next.precio_mensual,
      next.limite_empleados,
      next.limite_sucursales,
      next.activo,
    ],
  );

  return result.rows[0];
}

async function deactivatePlan(id) {
  const result = await pool.query(
    `
      UPDATE planes
      SET activo = FALSE,
          actualizado_en = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = {
  listPlanes,
  findPlanById,
  createPlan,
  updatePlan,
  deactivatePlan,
};
