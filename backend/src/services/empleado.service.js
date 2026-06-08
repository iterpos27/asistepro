const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

const EMPLEADO_ESTADOS = ['activo', 'inactivo', 'suspendido'];
const EMPLEADO_ROLES_ACCESO = ['EMPLEADO', 'RRHH'];

function validateEmpleadoPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.codigo !== undefined) {
    if (!payload.codigo?.trim()) errors.push('codigo es requerido');
  }

  if (!partial || payload.nombres !== undefined) {
    if (!payload.nombres?.trim()) errors.push('nombres es requerido');
  }

  if (!partial || payload.apellidos !== undefined) {
    if (!payload.apellidos?.trim()) errors.push('apellidos es requerido');
  }

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push('email invalido');
  }

  if (payload.estado !== undefined && !EMPLEADO_ESTADOS.includes(payload.estado)) {
    errors.push('estado invalido');
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

function validateUsuarioPayload(payload) {
  if (!payload.crear_usuario) return;

  const errors = [];
  const email = payload.email?.trim();
  const password = payload.password_acceso;
  const rol = payload.rol_acceso || 'EMPLEADO';

  if (!email) errors.push('email es requerido para crear usuario');
  if (!password || password.length < 8) errors.push('password_acceso debe tener al menos 8 caracteres');
  if (!EMPLEADO_ROLES_ACCESO.includes(rol)) errors.push('rol_acceso invalido');

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

async function assertSucursalInTenant(empresaId, sucursalId) {
  if (!sucursalId) return;

  const result = await pool.query(
    `
      SELECT id
      FROM sucursales
      WHERE empresa_id = $1
        AND id = $2
      LIMIT 1
    `,
    [empresaId, sucursalId],
  );

  if (!result.rows.length) {
    const error = new Error('sucursal_habitual_id no pertenece a la empresa');
    error.statusCode = 400;
    throw error;
  }
}

async function assertUsuarioInTenant(empresaId, usuarioId) {
  if (!usuarioId) return;

  const result = await pool.query(
    `
      SELECT id
      FROM usuarios
      WHERE empresa_id = $1
        AND id = $2
      LIMIT 1
    `,
    [empresaId, usuarioId],
  );

  if (!result.rows.length) {
    const error = new Error('usuario_id no pertenece a la empresa');
    error.statusCode = 400;
    throw error;
  }
}

async function createUsuarioAcceso(client, empresaId, payload) {
  const rolCodigo = payload.rol_acceso || 'EMPLEADO';
  const roleResult = await client.query('SELECT id FROM roles WHERE codigo = $1 LIMIT 1', [rolCodigo]);

  if (!roleResult.rows.length) {
    const error = new Error('rol_acceso no existe');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(payload.password_acceso, 10);
  const userResult = await client.query(
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
      RETURNING id
    `,
    [
      empresaId,
      roleResult.rows[0].id,
      payload.nombres.trim(),
      payload.apellidos.trim(),
      payload.email.trim().toLowerCase(),
      passwordHash,
      payload.telefono?.trim() || null,
    ],
  );

  return userResult.rows[0].id;
}

async function listEmpleados({ empresaId, search, estado, sucursalId, limit = 20, offset = 0 }) {
  const filters = ['e.empresa_id = $1'];
  const values = [empresaId];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      LOWER(e.codigo) LIKE $${values.length}
      OR LOWER(e.nombres) LIKE $${values.length}
      OR LOWER(e.apellidos) LIKE $${values.length}
      OR LOWER(COALESCE(e.email, '')) LIKE $${values.length}
    )`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`e.estado = $${values.length}`);
  }

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`e.sucursal_habitual_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        e.*,
        s.nombre AS sucursal_habitual_nombre,
        u.email AS usuario_email,
        COUNT(*) OVER() AS total
      FROM empleados e
      LEFT JOIN sucursales s ON s.id = e.sucursal_habitual_id
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      WHERE ${filters.join(' AND ')}
      ORDER BY e.creado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...empleado }) => empleado),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function findEmpleadoById(empresaId, id) {
  const result = await pool.query(
    `
      SELECT
        e.*,
        s.nombre AS sucursal_habitual_nombre,
        u.email AS usuario_email
      FROM empleados e
      LEFT JOIN sucursales s ON s.id = e.sucursal_habitual_id
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.empresa_id = $1
        AND e.id = $2
      LIMIT 1
    `,
    [empresaId, id],
  );

  return result.rows[0] || null;
}

async function createEmpleado(empresaId, payload) {
  validateEmpleadoPayload(payload);
  validateUsuarioPayload(payload);
  await assertSucursalInTenant(empresaId, payload.sucursal_habitual_id);
  await assertUsuarioInTenant(empresaId, payload.usuario_id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const usuarioId = payload.crear_usuario ? await createUsuarioAcceso(client, empresaId, payload) : payload.usuario_id || null;

    const result = await client.query(
      `
        INSERT INTO empleados (
          empresa_id,
          usuario_id,
          sucursal_habitual_id,
          codigo,
          nombres,
          apellidos,
          email,
          telefono,
          cargo,
          departamento,
          fecha_ingreso,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        empresaId,
        usuarioId,
        payload.sucursal_habitual_id || null,
        payload.codigo.trim().toUpperCase(),
        payload.nombres.trim(),
        payload.apellidos.trim(),
        payload.email?.trim().toLowerCase() || null,
        payload.telefono?.trim() || null,
        payload.cargo?.trim() || null,
        payload.departamento?.trim() || null,
        payload.fecha_ingreso || null,
        payload.estado || 'activo',
      ],
    );

    await client.query('COMMIT');
    return findEmpleadoById(empresaId, result.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateEmpleado(empresaId, id, payload) {
  validateEmpleadoPayload(payload, { partial: true });
  validateUsuarioPayload(payload);
  const current = await findEmpleadoById(empresaId, id);

  if (!current) return null;

  if (payload.crear_usuario && current.usuario_id) {
    const error = new Error('El empleado ya tiene usuario vinculado');
    error.statusCode = 400;
    throw error;
  }

  const next = {
    usuario_id: payload.usuario_id !== undefined ? payload.usuario_id || null : current.usuario_id,
    sucursal_habitual_id:
      payload.sucursal_habitual_id !== undefined
        ? payload.sucursal_habitual_id || null
        : current.sucursal_habitual_id,
    codigo: payload.codigo !== undefined ? payload.codigo.trim().toUpperCase() : current.codigo,
    nombres: payload.nombres !== undefined ? payload.nombres.trim() : current.nombres,
    apellidos: payload.apellidos !== undefined ? payload.apellidos.trim() : current.apellidos,
    email: payload.email !== undefined ? payload.email?.trim().toLowerCase() || null : current.email,
    telefono: payload.telefono !== undefined ? payload.telefono?.trim() || null : current.telefono,
    cargo: payload.cargo !== undefined ? payload.cargo?.trim() || null : current.cargo,
    departamento:
      payload.departamento !== undefined ? payload.departamento?.trim() || null : current.departamento,
    fecha_ingreso: payload.fecha_ingreso !== undefined ? payload.fecha_ingreso || null : current.fecha_ingreso,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
  };

  await assertSucursalInTenant(empresaId, next.sucursal_habitual_id);
  await assertUsuarioInTenant(empresaId, next.usuario_id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const usuarioId = payload.crear_usuario
      ? await createUsuarioAcceso(client, empresaId, { ...payload, nombres: next.nombres, apellidos: next.apellidos, telefono: next.telefono })
      : next.usuario_id;

    await client.query(
      `
        UPDATE empleados
        SET usuario_id = $3,
            sucursal_habitual_id = $4,
            codigo = $5,
            nombres = $6,
            apellidos = $7,
            email = $8,
            telefono = $9,
            cargo = $10,
            departamento = $11,
            fecha_ingreso = $12,
            estado = $13,
            actualizado_en = NOW()
        WHERE empresa_id = $1
          AND id = $2
      `,
      [
        empresaId,
        id,
        usuarioId,
        next.sucursal_habitual_id,
        next.codigo,
        next.nombres,
        next.apellidos,
        next.email,
        next.telefono,
        next.cargo,
        next.departamento,
        next.fecha_ingreso,
        next.estado,
      ],
    );

    await client.query('COMMIT');
    return findEmpleadoById(empresaId, id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deactivateEmpleado(empresaId, id) {
  const result = await pool.query(
    `
      UPDATE empleados
      SET estado = 'inactivo',
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
      RETURNING id
    `,
    [empresaId, id],
  );

  if (!result.rows.length) return null;

  return findEmpleadoById(empresaId, id);
}

module.exports = {
  listEmpleados,
  findEmpleadoById,
  createEmpleado,
  updateEmpleado,
  deactivateEmpleado,
};
