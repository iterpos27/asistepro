const crypto = require('crypto');

const { pool } = require('../config/database');

const SUCURSAL_ESTADOS = ['activa', 'inactiva', 'mantenimiento'];
const DYNAMIC_QR_TTL_SECONDS = Number(process.env.DYNAMIC_QR_TTL_SECONDS || 30);

function generateQrToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateSucursalPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.nombre !== undefined) {
    if (!payload.nombre?.trim()) errors.push('nombre es requerido');
  }

  if (!partial || payload.codigo !== undefined) {
    if (!payload.codigo?.trim()) errors.push('codigo es requerido');
  }

  if (!partial || payload.latitud !== undefined) {
    const latitud = Number(payload.latitud);
    if (Number.isNaN(latitud) || latitud < -90 || latitud > 90) {
      errors.push('latitud invalida');
    }
  }

  if (!partial || payload.longitud !== undefined) {
    const longitud = Number(payload.longitud);
    if (Number.isNaN(longitud) || longitud < -180 || longitud > 180) {
      errors.push('longitud invalida');
    }
  }

  if (payload.radio_metros !== undefined) {
    const radio = Number.parseInt(payload.radio_metros, 10);
    if (Number.isNaN(radio) || radio <= 0) errors.push('radio_metros debe ser mayor a cero');
  }

  if (payload.estado !== undefined && !SUCURSAL_ESTADOS.includes(payload.estado)) {
    errors.push('estado invalido');
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

function normalizeSucursalPayload(payload) {
  return {
    nombre: payload.nombre?.trim(),
    codigo: payload.codigo?.trim().toUpperCase(),
    direccion: payload.direccion?.trim() || null,
    ciudad: payload.ciudad?.trim() || null,
    latitud: Number(payload.latitud),
    longitud: Number(payload.longitud),
    radio_metros: Number.parseInt(payload.radio_metros || 100, 10),
    estado: payload.estado || 'activa',
  };
}

function buildQrPayload(sucursal) {
  return {
    type: 'ASISTEPRO_SUCURSAL',
    empresa_id: sucursal.empresa_id,
    sucursal_id: sucursal.id,
    qr_token: sucursal.qr_token,
  };
}

function buildDynamicQrPayload(sucursal, dynamicToken) {
  return {
    type: 'ASISTEPRO_SUCURSAL_DYNAMIC',
    empresa_id: sucursal.empresa_id,
    sucursal_id: sucursal.id,
    qr_token: dynamicToken.token,
    expira_en: dynamicToken.expira_en,
  };
}

async function listSucursales({ empresaId, search, estado, limit = 20, offset = 0 }) {
  const filters = ['empresa_id = $1'];
  const values = [empresaId];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      LOWER(nombre) LIKE $${values.length}
      OR LOWER(codigo) LIKE $${values.length}
      OR LOWER(COALESCE(ciudad, '')) LIKE $${values.length}
    )`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`estado = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT *, COUNT(*) OVER() AS total
      FROM sucursales
      WHERE ${filters.join(' AND ')}
      ORDER BY creado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...sucursal }) => sucursal),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function findSucursalById(empresaId, id) {
  const result = await pool.query(
    `
      SELECT *
      FROM sucursales
      WHERE empresa_id = $1
        AND id = $2
      LIMIT 1
    `,
    [empresaId, id],
  );

  return result.rows[0] || null;
}

async function createSucursal(empresaId, payload) {
  validateSucursalPayload(payload);
  const sucursal = normalizeSucursalPayload(payload);

  const result = await pool.query(
    `
      INSERT INTO sucursales (
        empresa_id,
        nombre,
        codigo,
        direccion,
        ciudad,
        latitud,
        longitud,
        radio_metros,
        qr_token,
        estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      empresaId,
      sucursal.nombre,
      sucursal.codigo,
      sucursal.direccion,
      sucursal.ciudad,
      sucursal.latitud,
      sucursal.longitud,
      sucursal.radio_metros,
      generateQrToken(),
      sucursal.estado,
    ],
  );

  return result.rows[0];
}

async function updateSucursal(empresaId, id, payload) {
  validateSucursalPayload(payload, { partial: true });
  const current = await findSucursalById(empresaId, id);

  if (!current) return null;

  const next = {
    nombre: payload.nombre !== undefined ? payload.nombre.trim() : current.nombre,
    codigo: payload.codigo !== undefined ? payload.codigo.trim().toUpperCase() : current.codigo,
    direccion: payload.direccion !== undefined ? payload.direccion?.trim() || null : current.direccion,
    ciudad: payload.ciudad !== undefined ? payload.ciudad?.trim() || null : current.ciudad,
    latitud: payload.latitud !== undefined ? Number(payload.latitud) : Number(current.latitud),
    longitud: payload.longitud !== undefined ? Number(payload.longitud) : Number(current.longitud),
    radio_metros:
      payload.radio_metros !== undefined ? Number.parseInt(payload.radio_metros, 10) : current.radio_metros,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
  };

  const result = await pool.query(
    `
      UPDATE sucursales
      SET nombre = $3,
          codigo = $4,
          direccion = $5,
          ciudad = $6,
          latitud = $7,
          longitud = $8,
          radio_metros = $9,
          estado = $10,
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      empresaId,
      id,
      next.nombre,
      next.codigo,
      next.direccion,
      next.ciudad,
      next.latitud,
      next.longitud,
      next.radio_metros,
      next.estado,
    ],
  );

  return result.rows[0] || null;
}

async function deactivateSucursal(empresaId, id) {
  const result = await pool.query(
    `
      UPDATE sucursales
      SET estado = 'inactiva',
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
      RETURNING *
    `,
    [empresaId, id],
  );

  return result.rows[0] || null;
}

async function rotateQrToken(empresaId, id) {
  const result = await pool.query(
    `
      UPDATE sucursales
      SET qr_token = $3,
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
      RETURNING *
    `,
    [empresaId, id, generateQrToken()],
  );

  return result.rows[0] || null;
}

async function generateDynamicQrToken(empresaId, id) {
  const sucursal = await findSucursalById(empresaId, id);

  if (!sucursal || sucursal.estado !== 'activa') {
    return null;
  }

  const token = generateQrToken();
  const expiraEn = new Date(Date.now() + DYNAMIC_QR_TTL_SECONDS * 1000);

  await pool.query(
    `
      DELETE FROM sucursal_tokens_dinamicos
      WHERE expira_en <= NOW() - INTERVAL '1 day'
    `,
  );

  const result = await pool.query(
    `
      INSERT INTO sucursal_tokens_dinamicos (sucursal_id, token, expira_en)
      VALUES ($1, $2, $3)
      RETURNING token, expira_en
    `,
    [id, token, expiraEn],
  );

  const dynamicToken = result.rows[0];

  return {
    sucursal,
    token: dynamicToken.token,
    expira_en: dynamicToken.expira_en,
    ttl_seconds: DYNAMIC_QR_TTL_SECONDS,
    qr_payload: buildDynamicQrPayload(sucursal, dynamicToken),
  };
}

module.exports = {
  buildQrPayload,
  buildDynamicQrPayload,
  listSucursales,
  findSucursalById,
  createSucursal,
  updateSucursal,
  deactivateSucursal,
  rotateQrToken,
  generateDynamicQrToken,
};
