const { pool } = require('../config/database');
const tenantService = require('./tenant.service');

const SUSCRIPCION_ESTADOS = ['activa', 'vencida', 'cancelada', 'suspendida'];

function validateSuscripcionPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.empresa_id !== undefined) {
    if (!payload.empresa_id) errors.push('empresa_id es requerido');
  }

  if (!partial || payload.plan_id !== undefined) {
    if (!payload.plan_id) errors.push('plan_id es requerido');
  }

  if (payload.estado !== undefined && !SUSCRIPCION_ESTADOS.includes(payload.estado)) {
    errors.push('estado invalido');
  }

  if (payload.monto_mensual !== undefined && Number(payload.monto_mensual) < 0) {
    errors.push('monto_mensual no puede ser negativo');
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

async function assertEmpresaAndPlan(empresaId, planId) {
  const result = await pool.query(
    `
      SELECT
        e.id AS empresa_id,
        p.id AS plan_id,
        p.precio_mensual,
        p.limite_empleados,
        p.limite_sucursales
      FROM empresas e
      CROSS JOIN planes p
      WHERE e.id = $1
        AND e.estado <> 'cancelada'
        AND p.id = $2
        AND p.activo = TRUE
      LIMIT 1
    `,
    [empresaId, planId],
  );

  if (!result.rows.length) {
    const error = new Error('empresa_id o plan_id invalido');
    error.statusCode = 400;
    throw error;
  }

  return result.rows[0];
}

async function listSuscripciones({ empresaId, estado, limit = 20, offset = 0 }) {
  const filters = [];
  const values = [];

  if (empresaId) {
    values.push(empresaId);
    filters.push(`s.empresa_id = $${values.length}`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`s.estado = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        s.*,
        e.nombre AS empresa_nombre,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre,
        COUNT(*) OVER() AS total
      FROM suscripciones s
      INNER JOIN empresas e ON e.id = s.empresa_id
      INNER JOIN planes p ON p.id = s.plan_id
      ${where}
      ORDER BY s.creado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...suscripcion }) => suscripcion),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function findSuscripcionById(id) {
  const result = await pool.query(
    `
      SELECT
        s.*,
        e.nombre AS empresa_nombre,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre
      FROM suscripciones s
      INNER JOIN empresas e ON e.id = s.empresa_id
      INNER JOIN planes p ON p.id = s.plan_id
      WHERE s.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function createSuscripcion(payload) {
  validateSuscripcionPayload(payload);

  const valid = await assertEmpresaAndPlan(payload.empresa_id, payload.plan_id);
  if ((payload.estado || 'activa') === 'activa') {
    await tenantService.assertPlanCapacity({
      empresaId: payload.empresa_id,
      plan: valid,
    });
  }
  const montoMensual =
    payload.monto_mensual !== undefined ? Number(payload.monto_mensual) : Number(valid.precio_mensual);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if ((payload.estado || 'activa') === 'activa') {
      await client.query(
        `
          UPDATE suscripciones
          SET estado = 'cancelada',
              fecha_fin = COALESCE(fecha_fin, CURRENT_DATE),
              actualizado_en = NOW()
          WHERE empresa_id = $1
            AND estado = 'activa'
        `,
        [payload.empresa_id],
      );
    }

    const result = await client.query(
      `
        INSERT INTO suscripciones (
          empresa_id,
          plan_id,
          estado,
          fecha_inicio,
          fecha_fin,
          monto_mensual
        ) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6)
        RETURNING *
      `,
      [
        payload.empresa_id,
        payload.plan_id,
        payload.estado || 'activa',
        payload.fecha_inicio || null,
        payload.fecha_fin || null,
        montoMensual,
      ],
    );

    if ((payload.estado || 'activa') === 'activa') {
      await client.query('UPDATE empresas SET plan_id = $2, actualizado_en = NOW() WHERE id = $1', [
        payload.empresa_id,
        payload.plan_id,
      ]);
    }

    await client.query('COMMIT');

    return findSuscripcionById(result.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateSuscripcion(id, payload) {
  validateSuscripcionPayload(payload, { partial: true });
  const current = await findSuscripcionById(id);

  if (!current) return null;

  const next = {
    empresa_id: current.empresa_id,
    plan_id: payload.plan_id !== undefined ? payload.plan_id : current.plan_id,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
    fecha_inicio: payload.fecha_inicio !== undefined ? payload.fecha_inicio : current.fecha_inicio,
    fecha_fin: payload.fecha_fin !== undefined ? payload.fecha_fin : current.fecha_fin,
    monto_mensual:
      payload.monto_mensual !== undefined ? Number(payload.monto_mensual) : Number(current.monto_mensual),
  };

  const valid = await assertEmpresaAndPlan(next.empresa_id, next.plan_id);
  if (next.estado === 'activa') {
    await tenantService.assertPlanCapacity({
      empresaId: next.empresa_id,
      plan: valid,
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (next.estado === 'activa') {
      await client.query(
        `
          UPDATE suscripciones
          SET estado = 'cancelada',
              fecha_fin = COALESCE(fecha_fin, CURRENT_DATE),
              actualizado_en = NOW()
          WHERE empresa_id = $1
            AND estado = 'activa'
            AND id <> $2
        `,
        [next.empresa_id, id],
      );
    }

    const result = await client.query(
      `
        UPDATE suscripciones
        SET plan_id = $2,
            estado = $3,
            fecha_inicio = $4,
            fecha_fin = $5,
            monto_mensual = $6,
            actualizado_en = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, next.plan_id, next.estado, next.fecha_inicio, next.fecha_fin, next.monto_mensual],
    );

    if (next.estado === 'activa') {
      await client.query('UPDATE empresas SET plan_id = $2, actualizado_en = NOW() WHERE id = $1', [
        next.empresa_id,
        next.plan_id,
      ]);
    }

    await client.query('COMMIT');

    return findSuscripcionById(result.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cancelSuscripcion(id) {
  const result = await pool.query(
    `
      UPDATE suscripciones
      SET estado = 'cancelada',
          fecha_fin = COALESCE(fecha_fin, CURRENT_DATE),
          actualizado_en = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  if (!result.rows[0]) return null;

  return findSuscripcionById(id);
}

module.exports = {
  listSuscripciones,
  findSuscripcionById,
  createSuscripcion,
  updateSuscripcion,
  cancelSuscripcion,
};
