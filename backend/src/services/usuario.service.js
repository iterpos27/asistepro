const { pool } = require('../config/database');
const { MODULES, buildEffectiveModules, normalizeModulePermissions } = require('../utils/module-permissions.util');
const { RESOURCES, mergePermissions, normalizePermissions } = require('../utils/granular-permissions.util');

function allowedTargetRoles(actorRole) {
  if (actorRole === 'SUPER_ADMIN') return ['ADMIN_EMPRESA'];
  if (actorRole === 'ADMIN_EMPRESA') return ['RRHH', 'EMPLEADO'];
  return [];
}

function assertCanManageRole(actorRole, targetRole) {
  if (!allowedTargetRoles(actorRole).includes(targetRole)) {
    const error = new Error('No puede administrar permisos de este rol');
    error.statusCode = 403;
    throw error;
  }
}

async function listUsuariosPermisos({ empresaId, actorRole }) {
  const roles = allowedTargetRoles(actorRole);

  if (!roles.length) {
    return { modules: MODULES, items: [] };
  }

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.nombre,
        u.apellido,
        u.email,
        u.estado,
        u.configuracion_modulos AS usuario_configuracion_modulos,
        u.configuracion_permisos AS usuario_configuracion_permisos,
        u.rol_personalizado_id,
        r.codigo AS rol_codigo,
        e.configuracion_modulos AS empresa_configuracion_modulos,
        emp.codigo AS empleado_codigo,
        rp.nombre AS rol_personalizado_nombre,
        rp.permisos AS rol_personalizado_permisos
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      LEFT JOIN empresas e ON e.id = u.empresa_id
      LEFT JOIN empleados emp ON emp.usuario_id = u.id
      LEFT JOIN roles_personalizados rp ON rp.id = u.rol_personalizado_id AND rp.activo = TRUE
      WHERE u.empresa_id = $1
        AND r.codigo = ANY($2)
      ORDER BY r.codigo ASC, u.nombre ASC, u.apellido ASC, u.email ASC
    `,
    [empresaId, roles],
  );

  return {
    modules: MODULES,
    resources: RESOURCES,
    items: result.rows.map((user) => ({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      estado: user.estado,
      rol: user.rol_codigo,
      empleado_codigo: user.empleado_codigo,
      modulos: buildEffectiveModules({
        empresaModules: user.empresa_configuracion_modulos,
        userModules: user.usuario_configuracion_modulos,
        role: user.rol_codigo,
      }),
      overrides: user.usuario_configuracion_modulos || {},
      permisos: mergePermissions(user.rol_codigo, user.rol_personalizado_permisos, user.usuario_configuracion_permisos),
      permisos_overrides: user.usuario_configuracion_permisos || {},
      rol_personalizado_id: user.rol_personalizado_id,
      rol_personalizado_nombre: user.rol_personalizado_nombre,
    })),
  };
}

async function listRolesPersonalizados(empresaId) {
  const result = await pool.query(`SELECT * FROM roles_personalizados WHERE empresa_id=$1 ORDER BY activo DESC,nombre`, [empresaId]);
  return { resources: RESOURCES, items: result.rows };
}

async function saveRolPersonalizado({ empresaId, usuarioId, id, payload }) {
  const permissions = normalizePermissions(payload.permisos || {});
  if (id) {
    const result = await pool.query(`UPDATE roles_personalizados SET nombre=$3,descripcion=$4,rol_base=$5,permisos=$6::jsonb,activo=$7,actualizado_en=NOW() WHERE empresa_id=$1 AND id=$2 RETURNING *`, [empresaId, id, payload.nombre, payload.descripcion || null, payload.rol_base, JSON.stringify(permissions), payload.activo !== false]);
    if (!result.rows[0]) { const error = new Error('Perfil personalizado no encontrado'); error.statusCode = 404; throw error; }
    return result.rows[0];
  }
  const result = await pool.query(`INSERT INTO roles_personalizados (empresa_id,nombre,descripcion,rol_base,permisos,creado_por) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`, [empresaId, payload.nombre, payload.descripcion || null, payload.rol_base, JSON.stringify(permissions), usuarioId]);
  return result.rows[0];
}

async function assignRolPersonalizado({ empresaId, actorRole, usuarioId, rolPersonalizadoId, permisos }) {
  const userResult = await pool.query(`SELECT u.id,r.codigo AS rol_codigo FROM usuarios u INNER JOIN roles r ON r.id=u.rol_id WHERE u.empresa_id=$1 AND u.id=$2`, [empresaId, usuarioId]);
  const user = userResult.rows[0];
  if (!user) { const error = new Error('Usuario no encontrado'); error.statusCode = 404; throw error; }
  assertCanManageRole(actorRole, user.rol_codigo);
  if (rolPersonalizadoId) {
    const roleResult = await pool.query(`SELECT id FROM roles_personalizados WHERE empresa_id=$1 AND id=$2 AND rol_base=$3 AND activo=TRUE`, [empresaId, rolPersonalizadoId, user.rol_codigo]);
    if (!roleResult.rows.length) { const error = new Error('Perfil incompatible con el rol base del usuario'); error.statusCode = 400; throw error; }
  }
  await pool.query(`UPDATE usuarios SET rol_personalizado_id=$3,configuracion_permisos=$4::jsonb,actualizado_en=NOW() WHERE empresa_id=$1 AND id=$2`, [empresaId, usuarioId, rolPersonalizadoId || null, JSON.stringify(normalizePermissions(permisos || {}))]);
  return listUsuariosPermisos({ empresaId, actorRole });
}

async function updateUsuarioPermisos({ empresaId, actorRole, usuarioId, modulos }) {
  const userResult = await pool.query(
    `
      SELECT u.id, r.codigo AS rol_codigo
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      WHERE u.empresa_id = $1
        AND u.id = $2
      LIMIT 1
    `,
    [empresaId, usuarioId],
  );

  const user = userResult.rows[0];
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  assertCanManageRole(actorRole, user.rol_codigo);

  const allowedKeys = new Set(MODULES.filter((module) => module.roles.includes(user.rol_codigo)).map((module) => module.key));
  const normalized = normalizeModulePermissions(modulos);
  const filtered = Object.fromEntries(Object.entries(normalized).filter(([key]) => allowedKeys.has(key)));

  await pool.query(
    `
      UPDATE usuarios
      SET configuracion_modulos = $3::jsonb,
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
    `,
    [empresaId, usuarioId, JSON.stringify(filtered)],
  );

  return listUsuariosPermisos({ empresaId, actorRole });
}

module.exports = {
  listUsuariosPermisos,
  updateUsuarioPermisos,
  assignRolPersonalizado,
  listRolesPersonalizados,
  saveRolPersonalizado,
};
