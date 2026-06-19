const { pool } = require('../config/database');

async function getOverview() {
  const [summary, plans, risks] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE e.estado = 'activa')::int AS empresas_activas,
          COUNT(*) FILTER (WHERE s.estado = 'activa')::int AS suscripciones_activas,
          COALESCE(SUM(s.monto_mensual) FILTER (WHERE s.estado = 'activa'), 0)::numeric(12, 2) AS mrr,
          COALESCE(SUM(f.total - COALESCE(p.total_pagado, 0)) FILTER (WHERE f.estado = 'pendiente'), 0)::numeric(12, 2) AS saldo_pendiente,
          COUNT(*) FILTER (WHERE f.estado = 'pendiente' AND f.fecha_vencimiento < CURRENT_DATE)::int AS facturas_vencidas,
          COALESCE(SUM(p.total_pagado) FILTER (WHERE p.mes_actual), 0)::numeric(12, 2) AS cobrado_mes
        FROM empresas e
        LEFT JOIN LATERAL (
          SELECT *
          FROM suscripciones s1
          WHERE s1.empresa_id = e.id
          ORDER BY s1.creado_en DESC
          LIMIT 1
        ) s ON TRUE
        LEFT JOIN facturas f ON f.empresa_id = e.id
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(pg.monto) FILTER (WHERE pg.estado = 'registrado'), 0)::numeric(12, 2) AS total_pagado,
            BOOL_OR(date_trunc('month', pg.pagado_en) = date_trunc('month', NOW())) AS mes_actual
          FROM pagos pg
          WHERE pg.factura_id = f.id
        ) p ON TRUE
      `,
    ),
    pool.query(
      `
        SELECT p.nombre, p.codigo, COUNT(s.id)::int AS total
        FROM planes p
        LEFT JOIN suscripciones s ON s.plan_id = p.id AND s.estado = 'activa'
        GROUP BY p.id
        ORDER BY total DESC, p.nombre ASC
      `,
    ),
    pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE riesgo_limite)::int AS con_limite_critico,
          COUNT(*) FILTER (WHERE riesgo_cobro)::int AS con_cobro_pendiente,
          COUNT(*) FILTER (WHERE riesgo_inactividad)::int AS con_baja_actividad
        FROM (
          SELECT
            e.id,
            (
              (COALESCE(emp.total_empleados, 0) >= COALESCE(pl.limite_empleados, 999999))
              OR (COALESCE(suc.total_sucursales, 0) >= COALESCE(pl.limite_sucursales, 999999))
            ) AS riesgo_limite,
            (COALESCE(fin.saldo_pendiente, 0) > 0 AND COALESCE(fin.facturas_vencidas, 0) > 0) AS riesgo_cobro,
            (COALESCE(marc.total_mes, 0) = 0) AS riesgo_inactividad
          FROM empresas e
          LEFT JOIN LATERAL (
            SELECT s.*, p.limite_empleados, p.limite_sucursales
            FROM suscripciones s
            INNER JOIN planes p ON p.id = s.plan_id
            WHERE s.empresa_id = e.id
            ORDER BY s.creado_en DESC
            LIMIT 1
          ) pl ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS total_empleados FROM empleados WHERE empresa_id = e.id AND estado = 'activo'
          ) emp ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS total_sucursales FROM sucursales WHERE empresa_id = e.id AND estado = 'activa'
          ) suc ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE)::int AS facturas_vencidas,
              COALESCE(SUM(total), 0)::numeric(12, 2) AS saldo_pendiente
            FROM facturas
            WHERE empresa_id = e.id
              AND estado = 'pendiente'
          ) fin ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS total_mes
            FROM marcaciones
            WHERE empresa_id = e.id
              AND date_trunc('month', marcado_en) = date_trunc('month', NOW())
          ) marc ON TRUE
        ) t
      `,
    ),
  ]);

  return {
    resumen: summary.rows[0] || {},
    planes: plans.rows,
    riesgos: risks.rows[0] || {},
  };
}

async function listTenants() {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.nombre,
        e.estado,
        e.email,
        plan.codigo AS plan_codigo,
        plan.nombre AS plan_nombre,
        plan.limite_empleados,
        plan.limite_sucursales,
        plan.limite_importaciones_mensuales,
        plan.limite_integraciones,
        plan.limite_almacenamiento_mb,
        COALESCE(emp.total_empleados, 0)::int AS total_empleados,
        COALESCE(suc.total_sucursales, 0)::int AS total_sucursales,
        COALESCE(imp.total_mes, 0)::int AS importaciones_mes,
        COALESCE(intg.total_activas, 0)::int AS integraciones_activas,
        COALESCE(marc.total_mes, 0)::int AS marcaciones_mes,
        COALESCE(fin.saldo_pendiente, 0)::numeric(12, 2) AS saldo_pendiente,
        COALESCE(fin.facturas_vencidas, 0)::int AS facturas_vencidas,
        COALESCE(storage.almacenamiento_mb, 0)::numeric(12, 2) AS almacenamiento_mb
      FROM empresas e
      LEFT JOIN LATERAL (
        SELECT s.*, p.codigo, p.nombre, p.limite_empleados, p.limite_sucursales,
               p.limite_importaciones_mensuales, p.limite_integraciones, p.limite_almacenamiento_mb
        FROM suscripciones s
        INNER JOIN planes p ON p.id = s.plan_id
        WHERE s.empresa_id = e.id
        ORDER BY s.creado_en DESC
        LIMIT 1
      ) plan ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_empleados FROM empleados WHERE empresa_id = e.id AND estado = 'activo'
      ) emp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_sucursales FROM sucursales WHERE empresa_id = e.id AND estado = 'activa'
      ) suc ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_mes
        FROM importaciones_empleados
        WHERE empresa_id = e.id AND creado_en >= date_trunc('month', NOW())
      ) imp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_activas
        FROM integraciones_externas
        WHERE empresa_id = e.id AND estado = 'activa'
      ) intg ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_mes
        FROM marcaciones
        WHERE empresa_id = e.id AND date_trunc('month', marcado_en) = date_trunc('month', NOW())
      ) marc ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE)::int AS facturas_vencidas,
          COALESCE(SUM(total), 0)::numeric(12, 2) AS saldo_pendiente
        FROM facturas
        WHERE empresa_id = e.id
          AND estado = 'pendiente'
      ) fin ON TRUE
      LEFT JOIN LATERAL (
        SELECT ROUND((
          COALESCE(SUM(OCTET_LENGTH(pdf_data)), 0)
          + COALESCE((SELECT SUM(OCTET_LENGTH(comprobante_data)) FROM pagos WHERE empresa_id = e.id), 0)
        )::numeric / 1024 / 1024, 2) AS almacenamiento_mb
        FROM facturas
        WHERE empresa_id = e.id
      ) storage ON TRUE
      ORDER BY e.creado_en DESC
    `,
  );

  return result.rows.map((row) => ({
    ...row,
    riesgo_limite_empleados:
      row.limite_empleados !== null && Number(row.total_empleados) >= Number(row.limite_empleados),
    riesgo_limite_sucursales:
      row.limite_sucursales !== null && Number(row.total_sucursales) >= Number(row.limite_sucursales),
    riesgo_cobranza: Number(row.saldo_pendiente || 0) > 0 && Number(row.facturas_vencidas || 0) > 0,
    riesgo_importaciones:
      row.limite_importaciones_mensuales !== null
      && Number(row.importaciones_mes) >= Number(row.limite_importaciones_mensuales),
    riesgo_integraciones:
      row.limite_integraciones !== null && Number(row.integraciones_activas) >= Number(row.limite_integraciones),
    riesgo_storage:
      row.limite_almacenamiento_mb !== null && Number(row.almacenamiento_mb || 0) >= Number(row.limite_almacenamiento_mb),
  }));
}

module.exports = {
  getOverview,
  listTenants,
};
