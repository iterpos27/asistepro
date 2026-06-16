const { pool } = require('../config/database');

async function findEmpresaById(empresaId) {
  const result = await pool.query(
    `
      SELECT
        id,
        plan_id,
        nombre,
        identificacion_fiscal,
        email,
        estado,
        configuracion_modulos
      FROM empresas
      WHERE id = $1
      LIMIT 1
    `,
    [empresaId],
  );

  return result.rows[0] || null;
}

async function findFirstActiveEmpresa() {
  const result = await pool.query(
    `
      SELECT
        id,
        plan_id,
        nombre,
        identificacion_fiscal,
        email,
        estado
      FROM empresas
      WHERE estado = 'activa'
      ORDER BY creado_en DESC
      LIMIT 1
    `,
  );

  return result.rows[0] || null;
}

async function findActiveSubscription(empresaId) {
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.empresa_id,
        s.plan_id,
        s.estado,
        s.fecha_inicio,
        s.fecha_fin,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre,
        p.limite_empleados,
        p.limite_sucursales
      FROM suscripciones s
      INNER JOIN planes p ON p.id = s.plan_id
      WHERE s.empresa_id = $1
        AND s.estado = 'activa'
        AND s.fecha_inicio <= CURRENT_DATE
        AND (s.fecha_fin IS NULL OR s.fecha_fin >= CURRENT_DATE)
      ORDER BY s.creado_en DESC
      LIMIT 1
    `,
    [empresaId],
  );

  return result.rows[0] || null;
}

async function getTenantUsage(empresaId) {
  const result = await pool.query(
    `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM empleados
          WHERE empresa_id = $1
            AND estado <> 'inactivo'
        ) AS empleados,
        (
          SELECT COUNT(*)::int
          FROM sucursales
          WHERE empresa_id = $1
            AND estado <> 'inactiva'
        ) AS sucursales
    `,
    [empresaId],
  );

  return {
    empleados: Number(result.rows[0]?.empleados || 0),
    sucursales: Number(result.rows[0]?.sucursales || 0),
  };
}

function normalizeLimit(limit) {
  if (limit === null || limit === undefined) return null;
  const parsed = Number(limit);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertPlanCapacityForUsage({ plan, usage, includeNew = {} }) {
  const empleadoLimit = normalizeLimit(plan?.limite_empleados);
  const sucursalLimit = normalizeLimit(plan?.limite_sucursales);
  const nextEmpleados = usage.empleados + (includeNew.empleados || 0);
  const nextSucursales = usage.sucursales + (includeNew.sucursales || 0);

  if (empleadoLimit !== null && nextEmpleados > empleadoLimit) {
    const error = new Error(`Limite de empleados del plan alcanzado (${empleadoLimit})`);
    error.statusCode = 409;
    throw error;
  }

  if (sucursalLimit !== null && nextSucursales > sucursalLimit) {
    const error = new Error(`Limite de sucursales del plan alcanzado (${sucursalLimit})`);
    error.statusCode = 409;
    throw error;
  }
}

async function assertPlanCapacity({ empresaId, plan, includeNew = {} }) {
  const usage = await getTenantUsage(empresaId);
  assertPlanCapacityForUsage({ plan, usage, includeNew });
  return usage;
}

module.exports = {
  assertPlanCapacity,
  assertPlanCapacityForUsage,
  findEmpresaById,
  findFirstActiveEmpresa,
  findActiveSubscription,
  getTenantUsage,
};
