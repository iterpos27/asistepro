const { pool } = require('../config/database');
const tenantService = require('./tenant.service');
const notificacionService = require('./notificacion.service');

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

  if (!partial) {
    const startStr = payload.fecha_inicio || new Date().toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const start = new Date(`${startStr}T00:00:00Z`);

    if (startStr < todayStr) {
      errors.push('La fecha de inicio no puede ser anterior a la actual');
    }

    if (payload.fecha_fin) {
      const end = new Date(`${payload.fecha_fin}T00:00:00Z`);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays !== 30) {
        errors.push('El periodo de la suscripcion debe ser de exactamente 30 dias');
      }
    } else {
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      const offset = end.getTimezoneOffset();
      const localEnd = new Date(end.getTime() - offset * 60 * 1000);
      payload.fecha_fin = localEnd.toISOString().slice(0, 10);
    }
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

async function checkSubscriptionExpirations() {
  const expiringSuscripciones = await pool.query(
    `
      SELECT
        s.id AS suscripcion_id,
        s.empresa_id,
        s.fecha_fin,
        e.nombre AS empresa_nombre,
        p.nombre AS plan_nombre
      FROM suscripciones s
      INNER JOIN empresas e ON e.id = s.empresa_id
      INNER JOIN planes p ON p.id = s.plan_id
      WHERE s.estado = 'activa'
        AND s.fecha_fin IS NOT NULL
        AND s.fecha_fin >= CURRENT_DATE
        AND s.fecha_fin <= CURRENT_DATE + INTERVAL '5 days'
        AND NOT EXISTS (
          SELECT 1
          FROM notificaciones n
          WHERE n.empresa_id = s.empresa_id
            AND n.tipo = 'factura'
            AND n.creado_en > NOW() - INTERVAL '5 days'
            AND (n.titulo LIKE '%vence%' OR n.titulo LIKE '%vencer%')
        )
    `
  );

  let count = 0;
  for (const row of expiringSuscripciones.rows) {
    const admins = await pool.query(
      `
        SELECT u.id
        FROM usuarios u
        INNER JOIN roles r ON r.id = u.rol_id
        WHERE u.empresa_id = $1
          AND r.codigo IN ('ADMIN_EMPRESA', 'RRHH')
          AND u.estado = 'activo'
      `,
      [row.empresa_id]
    );

    const formattedDate = row.fecha_fin ? new Date(row.fecha_fin).toISOString().slice(0, 10) : '';
    const titulo = 'Tu suscripción vence pronto';
    const mensaje = `Su suscripción al plan "${row.plan_nombre}" de la empresa "${row.empresa_nombre}" vencerá el ${formattedDate}. Por favor, registre su pago para evitar interrupciones.`;

    for (const admin of admins.rows) {
      await notificacionService.createNotificacion({
        empresaId: row.empresa_id,
        usuarioId: admin.id,
        titulo,
        mensaje,
        tipo: 'factura',
      });
      count++;
    }
  }

  return count;
}

async function runDatabaseCleanupAndSuspensions() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clean up expired dynamic QR tokens (expired more than 1 day ago)
    const qrCleanup = await client.query(
      `
        DELETE FROM sucursal_tokens_dinamicos
        WHERE expira_en <= NOW() - INTERVAL '1 day'
      `
    );
    console.log(`[Cleanup] Deleted ${qrCleanup.rowCount} expired dynamic QR tokens.`);

    // 2. Mark invoices past their due date as 'vencida' (overdue)
    const overdueInvoices = await client.query(
      `
        UPDATE facturas
        SET estado = 'vencida', actualizado_en = NOW()
        WHERE estado = 'pendiente'
          AND fecha_vencimiento < CURRENT_DATE
      `
    );
    console.log(`[Billing] Marked ${overdueInvoices.rowCount} pending invoices as overdue (vencida).`);

    // 3. Suspend companies (tenants) with invoices overdue by more than 5 days
    const suspendedCompanies = await client.query(
      `
        UPDATE empresas
        SET estado = 'suspendida', actualizado_en = NOW()
        WHERE estado = 'activa'
          AND id IN (
            SELECT empresa_id
            FROM facturas
            WHERE estado IN ('pendiente', 'vencida')
              AND fecha_vencimiento < CURRENT_DATE - INTERVAL '5 days'
          )
        RETURNING id, nombre
      `
    );

    if (suspendedCompanies.rows.length) {
      console.log(`[Billing] Suspended ${suspendedCompanies.rows.length} companies due to unpaid invoices:`, suspendedCompanies.rows.map(r => r.nombre).join(', '));

      // 4. Suspend active subscriptions for the suspended companies
      const companyIds = suspendedCompanies.rows.map(r => r.id);
      const suspendedSubs = await client.query(
        `
          UPDATE suscripciones
          SET estado = 'suspendida', actualizado_en = NOW()
          WHERE estado = 'activa'
            AND empresa_id = ANY($1::uuid[])
        `,
        [companyIds]
      );
      console.log(`[Billing] Suspended ${suspendedSubs.rowCount} active subscriptions for suspended companies.`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database cleanup and suspensions:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listSuscripciones,
  findSuscripcionById,
  createSuscripcion,
  updateSuscripcion,
  cancelSuscripcion,
  checkSubscriptionExpirations,
  validateSuscripcionPayload,
  runDatabaseCleanupAndSuspensions,
};
