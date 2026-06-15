const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const EMPRESA_ESTADOS = ['activa', 'suspendida', 'cancelada'];

function normalizeEmpresaPayload(payload) {
  return {
    plan_id: payload.plan_id || null,
    nombre: payload.nombre?.trim(),
    identificacion_fiscal: payload.identificacion_fiscal?.trim() || null,
    email: payload.email?.trim().toLowerCase() || null,
    telefono: payload.telefono?.trim() || null,
    direccion: payload.direccion?.trim() || null,
    estado: payload.estado || 'activa',
  };
}

function validateEmpresaPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.nombre !== undefined) {
    if (!payload.nombre?.trim()) {
      errors.push('nombre es requerido');
    }
  }

  if (payload.estado !== undefined && !EMPRESA_ESTADOS.includes(payload.estado)) {
    errors.push('estado invalido');
  }

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push('email invalido');
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

async function assertPlanExists(planId) {
  if (!planId) return;

  const result = await pool.query(
    'SELECT id FROM planes WHERE id = $1 AND activo = TRUE LIMIT 1',
    [planId],
  );

  if (!result.rows.length) {
    const error = new Error('plan_id no existe o esta inactivo');
    error.statusCode = 400;
    throw error;
  }
}

async function findRoleId(client, codigo) {
  const result = await client.query('SELECT id FROM roles WHERE codigo = $1 LIMIT 1', [codigo]);
  if (!result.rows.length) {
    const error = new Error(`Rol ${codigo} no existe`);
    error.statusCode = 400;
    throw error;
  }

  return result.rows[0].id;
}

async function listEmpresas({ search, estado, limit = 20, offset = 0 }) {
  const filters = [];
  const values = [];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      LOWER(e.nombre) LIKE $${values.length}
      OR LOWER(COALESCE(e.email, '')) LIKE $${values.length}
      OR LOWER(COALESCE(e.identificacion_fiscal, '')) LIKE $${values.length}
    )`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`e.estado = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.plan_id,
        e.nombre,
        e.identificacion_fiscal,
        e.email,
        e.telefono,
        e.direccion,
        e.estado,
        e.creado_en,
        e.actualizado_en,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre,
        COUNT(*) OVER() AS total
      FROM empresas e
      LEFT JOIN planes p ON p.id = e.plan_id
      ${where}
      ORDER BY e.creado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...empresa }) => empresa),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function findEmpresaById(id) {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.plan_id,
        e.nombre,
        e.identificacion_fiscal,
        e.email,
        e.telefono,
        e.direccion,
        e.estado,
        e.creado_en,
        e.actualizado_en,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre
      FROM empresas e
      LEFT JOIN planes p ON p.id = e.plan_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function createEmpresa(payload) {
  validateEmpresaPayload(payload);
  const empresa = normalizeEmpresaPayload(payload);

  await assertPlanExists(empresa.plan_id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO empresas (
          plan_id,
          nombre,
          identificacion_fiscal,
          email,
          telefono,
          direccion,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        empresa.plan_id,
        empresa.nombre,
        empresa.identificacion_fiscal,
        empresa.email,
        empresa.telefono,
        empresa.direccion,
        empresa.estado,
      ],
    );

    const empresaId = result.rows[0].id;

    if (payload.admin_email && payload.admin_password) {
      const rolId = await findRoleId(client, 'ADMIN_EMPRESA');
      const passwordHash = await bcrypt.hash(payload.admin_password, 10);
      const adminNombre = payload.admin_nombre?.trim() || 'Administrador';
      const adminApellido = payload.admin_apellido?.trim() || empresa.nombre;

      await client.query(
        `
          INSERT INTO usuarios (
            empresa_id,
            rol_id,
            nombre,
            apellido,
            email,
            password_hash,
            telefono,
            estado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
        `,
        [
          empresaId,
          rolId,
          adminNombre,
          adminApellido,
          payload.admin_email.trim().toLowerCase(),
          passwordHash,
          payload.admin_telefono?.trim() || empresa.telefono,
        ],
      );
    }

    await client.query('COMMIT');
    return findEmpresaById(empresaId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateEmpresa(id, payload) {
  validateEmpresaPayload(payload, { partial: true });

  const current = await findEmpresaById(id);

  if (!current) {
    return null;
  }

  const next = {
    plan_id: payload.plan_id !== undefined ? payload.plan_id || null : current.plan_id,
    nombre: payload.nombre !== undefined ? payload.nombre?.trim() : current.nombre,
    identificacion_fiscal:
      payload.identificacion_fiscal !== undefined
        ? payload.identificacion_fiscal?.trim() || null
        : current.identificacion_fiscal,
    email: payload.email !== undefined ? payload.email?.trim().toLowerCase() || null : current.email,
    telefono: payload.telefono !== undefined ? payload.telefono?.trim() || null : current.telefono,
    direccion: payload.direccion !== undefined ? payload.direccion?.trim() || null : current.direccion,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
  };

  await assertPlanExists(next.plan_id);

  await pool.query(
    `
      UPDATE empresas
      SET plan_id = $2,
          nombre = $3,
          identificacion_fiscal = $4,
          email = $5,
          telefono = $6,
          direccion = $7,
          estado = $8,
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [
      id,
      next.plan_id,
      next.nombre,
      next.identificacion_fiscal,
      next.email,
      next.telefono,
      next.direccion,
      next.estado,
    ],
  );

  return findEmpresaById(id);
}

async function deleteEmpresa(id) {
  const empresa = await findEmpresaById(id);

  if (!empresa) {
    return null;
  }

  await pool.query(
    `
      UPDATE empresas
      SET estado = 'cancelada',
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [id],
  );

  return findEmpresaById(id);
}

async function resetAdminPassword(id) {
  const empresa = await findEmpresaById(id);
  if (!empresa) {
    const error = new Error('Empresa no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const userResult = await pool.query(
    `
      SELECT u.id, u.email, u.nombre, u.apellido
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.empresa_id = $1 AND r.codigo = 'ADMIN_EMPRESA'
      LIMIT 1
    `,
    [id],
  );

  if (!userResult.rows.length) {
    const error = new Error('No se encontro un usuario administrador para esta empresa');
    error.statusCode = 404;
    throw error;
  }

  const user = userResult.rows[0];

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `
      UPDATE usuarios
      SET password_hash = $1, actualizado_en = NOW()
      WHERE id = $2
    `,
    [passwordHash, user.id],
  );

  return {
    email: user.email,
    nombre: user.nombre,
    apellido: user.apellido,
    tempPassword: password,
  };
}

module.exports = {
  listEmpresas,
  findEmpresaById,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
  resetAdminPassword,
};
