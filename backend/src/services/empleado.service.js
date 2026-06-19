const bcrypt = require('bcryptjs');
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

async function assertEstructuraInTenant(empresaId, estructuraId, tipos = []) {
  if (!estructuraId) return;

  const values = [empresaId, estructuraId];
  const typeFilter = tipos.length ? `AND tipo = ANY($3::text[])` : '';
  if (tipos.length) values.push(tipos);

  const result = await pool.query(
    `
      SELECT id
      FROM estructuras_organizacionales
      WHERE empresa_id = $1
        AND id = $2
        AND activo = TRUE
        ${typeFilter}
      LIMIT 1
    `,
    values,
  );

  if (!result.rows.length) {
    const error = new Error('La estructura organizacional indicada no pertenece a la empresa');
    error.statusCode = 400;
    throw error;
  }
}

async function assertSupervisorInTenant(empresaId, empleadoId, supervisorId) {
  if (!supervisorId) return;
  if (empleadoId && supervisorId === empleadoId) {
    const error = new Error('Un empleado no puede ser su propio supervisor');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      SELECT id
      FROM empleados
      WHERE empresa_id = $1
        AND id = $2
      LIMIT 1
    `,
    [empresaId, supervisorId],
  );

  if (!result.rows.length) {
    const error = new Error('supervisor_empleado_id no pertenece a la empresa');
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
        area.nombre AS area_nombre,
        cargo_org.nombre AS cargo_estructura_nombre,
        centro.nombre AS centro_costo_nombre,
        supervisor.codigo AS supervisor_codigo,
        supervisor.nombres AS supervisor_nombres,
        supervisor.apellidos AS supervisor_apellidos,
        COUNT(*) OVER() AS total
      FROM empleados e
      LEFT JOIN sucursales s ON s.id = e.sucursal_habitual_id
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      LEFT JOIN estructuras_organizacionales area ON area.id = e.area_estructura_id
      LEFT JOIN estructuras_organizacionales cargo_org ON cargo_org.id = e.cargo_estructura_id
      LEFT JOIN estructuras_organizacionales centro ON centro.id = e.centro_costo_estructura_id
      LEFT JOIN empleados supervisor ON supervisor.id = e.supervisor_empleado_id
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
        u.email AS usuario_email,
        area.nombre AS area_nombre,
        cargo_org.nombre AS cargo_estructura_nombre,
        centro.nombre AS centro_costo_nombre,
        supervisor.codigo AS supervisor_codigo,
        supervisor.nombres AS supervisor_nombres,
        supervisor.apellidos AS supervisor_apellidos
      FROM empleados e
      LEFT JOIN sucursales s ON s.id = e.sucursal_habitual_id
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      LEFT JOIN estructuras_organizacionales area ON area.id = e.area_estructura_id
      LEFT JOIN estructuras_organizacionales cargo_org ON cargo_org.id = e.cargo_estructura_id
      LEFT JOIN estructuras_organizacionales centro ON centro.id = e.centro_costo_estructura_id
      LEFT JOIN empleados supervisor ON supervisor.id = e.supervisor_empleado_id
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
  await assertEstructuraInTenant(empresaId, payload.area_estructura_id, ['direccion', 'departamento', 'area', 'unidad']);
  await assertEstructuraInTenant(empresaId, payload.cargo_estructura_id, ['cargo']);
  await assertEstructuraInTenant(empresaId, payload.centro_costo_estructura_id, ['centro_costo']);
  await assertSupervisorInTenant(empresaId, null, payload.supervisor_empleado_id);

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
          area_estructura_id,
          cargo_estructura_id,
          centro_costo_estructura_id,
          supervisor_empleado_id,
          tipo_contrato,
          salario_base,
          fecha_ingreso,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
        payload.area_estructura_id || null,
        payload.cargo_estructura_id || null,
        payload.centro_costo_estructura_id || null,
        payload.supervisor_empleado_id || null,
        payload.tipo_contrato?.trim() || null,
        payload.salario_base !== undefined && payload.salario_base !== null ? Number(payload.salario_base) : null,
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
    area_estructura_id:
      payload.area_estructura_id !== undefined ? payload.area_estructura_id || null : current.area_estructura_id,
    cargo_estructura_id:
      payload.cargo_estructura_id !== undefined ? payload.cargo_estructura_id || null : current.cargo_estructura_id,
    centro_costo_estructura_id:
      payload.centro_costo_estructura_id !== undefined
        ? payload.centro_costo_estructura_id || null
        : current.centro_costo_estructura_id,
    supervisor_empleado_id:
      payload.supervisor_empleado_id !== undefined
        ? payload.supervisor_empleado_id || null
        : current.supervisor_empleado_id,
    tipo_contrato:
      payload.tipo_contrato !== undefined ? payload.tipo_contrato?.trim() || null : current.tipo_contrato,
    salario_base:
      payload.salario_base !== undefined
        ? payload.salario_base === null ? null : Number(payload.salario_base)
        : current.salario_base,
    fecha_ingreso: payload.fecha_ingreso !== undefined ? payload.fecha_ingreso || null : current.fecha_ingreso,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
  };

  await assertSucursalInTenant(empresaId, next.sucursal_habitual_id);
  await assertUsuarioInTenant(empresaId, next.usuario_id);
  await assertEstructuraInTenant(empresaId, next.area_estructura_id, ['direccion', 'departamento', 'area', 'unidad']);
  await assertEstructuraInTenant(empresaId, next.cargo_estructura_id, ['cargo']);
  await assertEstructuraInTenant(empresaId, next.centro_costo_estructura_id, ['centro_costo']);
  await assertSupervisorInTenant(empresaId, id, next.supervisor_empleado_id);

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
            area_estructura_id = $12,
            cargo_estructura_id = $13,
            centro_costo_estructura_id = $14,
            supervisor_empleado_id = $15,
            tipo_contrato = $16,
            salario_base = $17,
            fecha_ingreso = $18,
            estado = $19,
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
        next.area_estructura_id,
        next.cargo_estructura_id,
        next.centro_costo_estructura_id,
        next.supervisor_empleado_id,
        next.tipo_contrato,
        next.salario_base,
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
