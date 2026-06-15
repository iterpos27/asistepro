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

module.exports = {
  findEmpresaById,
  findFirstActiveEmpresa,
  findActiveSubscription,
};
