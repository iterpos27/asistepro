const { pool } = require('../config/database');

const FACTURA_ESTADOS = ['pendiente', 'pagada', 'anulada', 'vencida'];
const PAGO_METODOS = ['manual', 'transferencia', 'efectivo', 'tarjeta', 'otro'];

function validateFacturaPayload(payload) {
  const errors = [];

  if (!payload.empresa_id) errors.push('empresa_id es requerido');
  if (!payload.concepto?.trim()) errors.push('concepto es requerido');
  if (payload.total !== undefined && Number(payload.total) < 0) errors.push('total no puede ser negativo');
  if (payload.estado !== undefined && !FACTURA_ESTADOS.includes(payload.estado)) errors.push('estado invalido');

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

function validatePagoPayload(payload) {
  const errors = [];

  if (!payload.factura_id) errors.push('factura_id es requerido');
  if (!payload.monto || Number(payload.monto) <= 0) errors.push('monto debe ser mayor a cero');
  if (payload.metodo !== undefined && !PAGO_METODOS.includes(payload.metodo)) errors.push('metodo invalido');

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

async function getNextInvoiceNumber(client) {
  const result = await client.query("SELECT COUNT(*)::int + 1 AS next FROM facturas");
  return `FAC-${String(result.rows[0].next).padStart(6, '0')}`;
}

async function listFacturas({ empresaId, estado, limit = 20, offset = 0 }) {
  const filters = [];
  const values = [];

  if (empresaId) {
    values.push(empresaId);
    filters.push(`f.empresa_id = $${values.length}`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`f.estado = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        f.*,
        e.nombre AS empresa_nombre,
        COALESCE(SUM(p.monto), 0)::numeric(10, 2) AS total_pagado,
        COUNT(*) OVER() AS total_registros
      FROM facturas f
      INNER JOIN empresas e ON e.id = f.empresa_id
      LEFT JOIN pagos p ON p.factura_id = f.id
      ${where}
      GROUP BY f.id, e.nombre
      ORDER BY f.creado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total_registros, ...factura }) => factura),
    total: Number(result.rows[0]?.total_registros || 0),
    limit,
    offset,
  };
}

async function findFacturaById(id) {
  const result = await pool.query(
    `
      SELECT
        f.*,
        e.nombre AS empresa_nombre,
        COALESCE(SUM(p.monto), 0)::numeric(10, 2) AS total_pagado
      FROM facturas f
      INNER JOIN empresas e ON e.id = f.empresa_id
      LEFT JOIN pagos p ON p.factura_id = f.id
      WHERE f.id = $1
      GROUP BY f.id, e.nombre
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function createFactura(payload) {
  validateFacturaPayload(payload);

  const subtotal = Number(payload.subtotal ?? payload.total ?? 0);
  const impuesto = Number(payload.impuesto ?? 0);
  const total = Number(payload.total ?? subtotal + impuesto);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const numero = payload.numero || (await getNextInvoiceNumber(client));

    const result = await client.query(
      `
        INSERT INTO facturas (
          empresa_id,
          suscripcion_id,
          numero,
          concepto,
          subtotal,
          impuesto,
          total,
          estado,
          fecha_emision,
          fecha_vencimiento
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10)
        RETURNING *
      `,
      [
        payload.empresa_id,
        payload.suscripcion_id || null,
        numero,
        payload.concepto.trim(),
        subtotal,
        impuesto,
        total,
        payload.estado || 'pendiente',
        payload.fecha_emision || null,
        payload.fecha_vencimiento || null,
      ],
    );

    await client.query('COMMIT');

    return findFacturaById(result.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function registerManualPayment(payload) {
  validatePagoPayload(payload);

  const factura = await findFacturaById(payload.factura_id);

  if (!factura) {
    const error = new Error('Factura no encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (factura.estado === 'anulada') {
    const error = new Error('No se puede pagar una factura anulada');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `
        INSERT INTO pagos (
          empresa_id,
          factura_id,
          monto,
          metodo,
          referencia,
          nota,
          pagado_en
        ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
        RETURNING *
      `,
      [
        factura.empresa_id,
        factura.id,
        Number(payload.monto),
        payload.metodo || 'manual',
        payload.referencia || null,
        payload.nota || null,
        payload.pagado_en || null,
      ],
    );

    const totalPagadoResult = await client.query(
      'SELECT COALESCE(SUM(monto), 0)::numeric AS total_pagado FROM pagos WHERE factura_id = $1',
      [factura.id],
    );

    if (Number(totalPagadoResult.rows[0].total_pagado) >= Number(factura.total)) {
      await client.query(
        `
          UPDATE facturas
          SET estado = 'pagada',
              actualizado_en = NOW()
          WHERE id = $1
        `,
        [factura.id],
      );
    }

    await client.query('COMMIT');

    return {
      pago: paymentResult.rows[0],
      factura: await findFacturaById(factura.id),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listPagos({ facturaId, empresaId, limit = 20, offset = 0 }) {
  const filters = [];
  const values = [];

  if (facturaId) {
    values.push(facturaId);
    filters.push(`p.factura_id = $${values.length}`);
  }

  if (empresaId) {
    values.push(empresaId);
    filters.push(`p.empresa_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT p.*, f.numero AS factura_numero, COUNT(*) OVER() AS total
      FROM pagos p
      INNER JOIN facturas f ON f.id = p.factura_id
      ${where}
      ORDER BY p.pagado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...pago }) => pago),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

module.exports = {
  listFacturas,
  findFacturaById,
  createFactura,
  registerManualPayment,
  listPagos,
};
