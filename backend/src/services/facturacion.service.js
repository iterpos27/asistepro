const { pool } = require('../config/database');

const FACTURA_ESTADOS = ['pendiente', 'pagada', 'anulada', 'vencida'];
const PAGO_METODOS = ['manual', 'transferencia', 'efectivo', 'tarjeta', 'otro'];
const PAGO_ESTADOS = ['pendiente', 'registrado'];
const COMPROBANTE_MAX_BYTES = 2 * 1024 * 1024;
const COMPROBANTE_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function validateFacturaPayload(payload) {
  const errors = [];

  if (!payload.empresa_id) errors.push('empresa_id es requerido');
  if (!payload.concepto?.trim()) errors.push('concepto es requerido');
  if (payload.total !== undefined && Number(payload.total) < 0) errors.push('total no puede ser negativo');
  if (payload.estado !== undefined && !FACTURA_ESTADOS.includes(payload.estado)) errors.push('estado invalido');

  if (payload.pdf) {
    const base64 = getComprobanteBase64(payload.pdf);
    const estimatedBytes = (base64.length * 3) / 4;
    if (estimatedBytes > COMPROBANTE_MAX_BYTES) {
      errors.push('El archivo PDF de la factura no puede superar 2MB');
    }
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

function validateFacturaUpdatePayload(payload) {
  const errors = [];

  if (payload.concepto !== undefined && !payload.concepto?.trim()) errors.push('concepto es requerido');
  if (payload.total !== undefined && Number(payload.total) < 0) errors.push('total no puede ser negativo');
  if (payload.subtotal !== undefined && Number(payload.subtotal) < 0) errors.push('subtotal no puede ser negativo');
  if (payload.impuesto !== undefined && Number(payload.impuesto) < 0) errors.push('impuesto no puede ser negativo');
  if (payload.estado !== undefined && !FACTURA_ESTADOS.includes(payload.estado)) errors.push('estado invalido');

  if (payload.pdf) {
    const base64 = getComprobanteBase64(payload.pdf);
    const estimatedBytes = (base64.length * 3) / 4;
    if (estimatedBytes > COMPROBANTE_MAX_BYTES) {
      errors.push('El archivo PDF de la factura no puede superar 2MB');
    }
  }

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
  if (payload.estado !== undefined && !PAGO_ESTADOS.includes(payload.estado)) errors.push('estado invalido');

  if (payload.comprobante) {
    const base64 = getComprobanteBase64(payload.comprobante);
    const estimatedBytes = (base64.length * 3) / 4;

    if (estimatedBytes > COMPROBANTE_MAX_BYTES) {
      errors.push('comprobante no puede superar 2MB');
    } else {
      const comprobante = normalizeComprobante(payload.comprobante);
      if (!comprobante.nombre) errors.push('nombre de comprobante es requerido');
      if (!COMPROBANTE_TIPOS.includes(comprobante.tipo)) errors.push('tipo de comprobante invalido');
      if (!comprobante.data.length) errors.push('archivo de comprobante vacio');
      if (comprobante.data.length > COMPROBANTE_MAX_BYTES) errors.push('comprobante no puede superar 2MB');
    }
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

function getComprobanteBase64(comprobante) {
  const rawBase64 = String(comprobante.data_base64 || comprobante.data || '');
  return rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
}

function normalizeComprobante(comprobante) {
  if (!comprobante) return null;

  const base64 = getComprobanteBase64(comprobante);

  return {
    nombre: String(comprobante.nombre || comprobante.name || '').trim().slice(0, 255),
    tipo: String(comprobante.tipo || comprobante.type || 'application/octet-stream').trim(),
    data: Buffer.from(base64, 'base64'),
  };
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
        f.id,
        f.empresa_id,
        f.suscripcion_id,
        f.numero,
        f.concepto,
        f.subtotal,
        f.impuesto,
        f.total,
        f.estado,
        f.fecha_emision,
        f.fecha_vencimiento,
        f.creado_en,
        f.actualizado_en,
        f.pdf_nombre,
        f.pdf_tipo,
        f.pdf_subido_en,
        (f.pdf_data IS NOT NULL) AS tiene_pdf,
        e.nombre AS empresa_nombre,
        COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'registrado'), 0)::numeric(10, 2) AS total_pagado,
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
        f.id,
        f.empresa_id,
        f.suscripcion_id,
        f.numero,
        f.concepto,
        f.subtotal,
        f.impuesto,
        f.total,
        f.estado,
        f.fecha_emision,
        f.fecha_vencimiento,
        f.creado_en,
        f.actualizado_en,
        f.pdf_nombre,
        f.pdf_tipo,
        f.pdf_subido_en,
        (f.pdf_data IS NOT NULL) AS tiene_pdf,
        e.nombre AS empresa_nombre,
        COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'registrado'), 0)::numeric(10, 2) AS total_pagado
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

async function recalculateFacturaEstado(client, facturaId) {
  const result = await client.query(
    `
      SELECT
        f.total,
        f.estado,
        COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'registrado'), 0)::numeric AS total_pagado
      FROM facturas f
      LEFT JOIN pagos p ON p.factura_id = f.id
      WHERE f.id = $1
      GROUP BY f.id
      LIMIT 1
    `,
    [facturaId],
  );

  const factura = result.rows[0];

  if (!factura || factura.estado === 'anulada') return;

  const nextEstado = Number(factura.total_pagado) >= Number(factura.total) ? 'pagada' : 'pendiente';

  await client.query(
    `
      UPDATE facturas
      SET estado = $2,
          actualizado_en = NOW()
      WHERE id = $1
        AND estado <> 'anulada'
    `,
    [facturaId, nextEstado],
  );
}

async function updateFactura(id, payload) {
  validateFacturaUpdatePayload(payload);

  const current = await findFacturaById(id);

  if (!current) return null;

  if (current.estado === 'anulada') {
    const error = new Error('No se puede modificar una factura anulada');
    error.statusCode = 400;
    throw error;
  }

  const next = {
    suscripcion_id:
      payload.suscripcion_id !== undefined ? payload.suscripcion_id || null : current.suscripcion_id,
    concepto: payload.concepto !== undefined ? payload.concepto.trim() : current.concepto,
    subtotal: payload.subtotal !== undefined ? Number(payload.subtotal) : Number(current.subtotal),
    impuesto: payload.impuesto !== undefined ? Number(payload.impuesto) : Number(current.impuesto),
    total: payload.total !== undefined ? Number(payload.total) : Number(current.total),
    estado: payload.estado !== undefined ? payload.estado : current.estado,
    fecha_emision: payload.fecha_emision !== undefined ? payload.fecha_emision : current.fecha_emision,
    fecha_vencimiento:
      payload.fecha_vencimiento !== undefined ? payload.fecha_vencimiento || null : current.fecha_vencimiento,
  };

  const pdf = payload.pdf !== undefined ? normalizeComprobante(payload.pdf) : undefined;

  await pool.query(
    `
      UPDATE facturas
      SET suscripcion_id = $2,
          concepto = $3,
          subtotal = $4,
          impuesto = $5,
          total = $6,
          estado = $7,
          fecha_emision = $8,
          fecha_vencimiento = $9,
          pdf_nombre = CASE WHEN $10::boolean THEN $11::varchar ELSE pdf_nombre END,
          pdf_tipo = CASE WHEN $10::boolean THEN $12::varchar ELSE pdf_tipo END,
          pdf_data = CASE WHEN $10::boolean THEN $13::bytea ELSE pdf_data END,
          pdf_subido_en = CASE WHEN $10::boolean THEN (CASE WHEN $13::bytea IS NULL THEN NULL ELSE NOW() END) ELSE pdf_subido_en END,
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [
      id,
      next.suscripcion_id,
      next.concepto,
      next.subtotal,
      next.impuesto,
      next.total,
      next.estado,
      next.fecha_emision,
      next.fecha_vencimiento,
      payload.pdf !== undefined,
      pdf?.nombre || null,
      pdf?.tipo || null,
      pdf?.data || null,
    ],
  );

  return findFacturaById(id);
}

async function anulacionFactura(id, motivoAnulacion) {
  const factura = await findFacturaById(id);

  if (!factura) return null;

  await pool.query(
    `
      UPDATE facturas
      SET estado = 'anulada',
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [id],
  );

  await pool.query(
    `
      UPDATE pagos
      SET estado = 'anulado',
          anulado_en = COALESCE(anulado_en, NOW()),
          motivo_anulacion = COALESCE(motivo_anulacion, $2)
      WHERE factura_id = $1
        AND estado = 'registrado'
    `,
    [id, motivoAnulacion || null],
  );

  return findFacturaById(id);
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
    const pdf = normalizeComprobante(payload.pdf);

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
          fecha_vencimiento,
          pdf_nombre,
          pdf_tipo,
          pdf_data,
          pdf_subido_en
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10, $11, $12, $13, CASE WHEN $13::bytea IS NULL THEN NULL ELSE NOW() END)
        RETURNING id
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
        pdf?.nombre || null,
        pdf?.tipo || null,
        pdf?.data || null,
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
    const comprobante = normalizeComprobante(payload.comprobante);

    const paymentResult = await client.query(
      `
        INSERT INTO pagos (
          empresa_id,
          factura_id,
          monto,
          metodo,
          referencia,
          nota,
          estado,
          pagado_en,
          comprobante_nombre,
          comprobante_tipo,
          comprobante_data,
          comprobante_subido_en
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()), $9, $10, $11, CASE WHEN $11::bytea IS NULL THEN NULL ELSE NOW() END)
        RETURNING *
      `,
      [
        factura.empresa_id,
        factura.id,
        Number(payload.monto),
        payload.metodo || 'manual',
        payload.referencia || null,
        payload.nota || null,
        payload.estado || 'registrado',
        payload.pagado_en || null,
        comprobante?.nombre || null,
        comprobante?.tipo || null,
        comprobante?.data || null,
      ],
    );

    await recalculateFacturaEstado(client, factura.id);

    await client.query('COMMIT');

    return {
      pago: await findPagoById(paymentResult.rows[0].id),
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
      SELECT
        p.id,
        p.empresa_id,
        p.factura_id,
        p.monto,
        p.metodo,
        p.referencia,
        p.nota,
        p.estado,
        p.pagado_en,
        p.anulado_en,
        p.motivo_anulacion,
        p.comprobante_nombre,
        p.comprobante_tipo,
        p.comprobante_subido_en,
        (p.comprobante_data IS NOT NULL) AS tiene_comprobante,
        p.creado_en,
        p.actualizado_en,
        f.numero AS factura_numero,
        COUNT(*) OVER() AS total
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

async function aprobarPago(id) {
  const pago = await findPagoById(id);

  if (!pago) return null;

  if (pago.estado === 'anulado') {
    const error = new Error('No se puede aprobar un pago anulado');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `
        UPDATE pagos
        SET estado = 'registrado',
            actualizado_en = NOW()
        WHERE id = $1
      `,
      [id],
    );

    await recalculateFacturaEstado(client, pago.factura_id);
    await client.query('COMMIT');

    return {
      pago: await findPagoById(id),
      factura: await findFacturaById(pago.factura_id),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findPagoById(id) {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.empresa_id,
        p.factura_id,
        p.monto,
        p.metodo,
        p.referencia,
        p.nota,
        p.estado,
        p.pagado_en,
        p.anulado_en,
        p.motivo_anulacion,
        p.comprobante_nombre,
        p.comprobante_tipo,
        p.comprobante_subido_en,
        (p.comprobante_data IS NOT NULL) AS tiene_comprobante,
        p.creado_en,
        p.actualizado_en,
        f.numero AS factura_numero,
        f.empresa_id AS factura_empresa_id
      FROM pagos p
      INNER JOIN facturas f ON f.id = p.factura_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function findPagoComprobante(id) {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.empresa_id,
        p.factura_id,
        p.comprobante_nombre,
        p.comprobante_tipo,
        p.comprobante_data,
        f.numero AS factura_numero,
        f.empresa_id AS factura_empresa_id
      FROM pagos p
      INNER JOIN facturas f ON f.id = p.factura_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function anulacionPago(id, motivoAnulacion) {
  const pago = await findPagoById(id);

  if (!pago) return null;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `
        UPDATE pagos
        SET estado = 'anulado',
            anulado_en = NOW(),
            motivo_anulacion = $2,
            actualizado_en = NOW()
        WHERE id = $1
      `,
      [id, motivoAnulacion || null],
    );

    await recalculateFacturaEstado(client, pago.factura_id);
    await client.query('COMMIT');

    return {
      pago: await findPagoById(id),
      factura: await findFacturaById(pago.factura_id),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findFacturaPdf(id) {
  const result = await pool.query(
    `
      SELECT id, empresa_id, pdf_nombre, pdf_tipo, pdf_data, numero
      FROM facturas
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = {
  listFacturas,
  findFacturaById,
  createFactura,
  updateFactura,
  anulacionFactura,
  findFacturaPdf,
  registerManualPayment,
  aprobarPago,
  listPagos,
  findPagoById,
  findPagoComprobante,
  anulacionPago,
};
