const ACTIONS = ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar', 'cerrar', 'reabrir'];

const RESOURCES = [
  { key: 'solicitudes', label: 'Solicitudes', actions: ['ver', 'crear', 'aprobar'] },
  { key: 'calculo_laboral', label: 'Calculo laboral', actions: ['ver', 'exportar'] },
  { key: 'cierres_mensuales', label: 'Cierres mensuales', actions: ['ver', 'cerrar', 'reabrir'] },
  { key: 'auditoria', label: 'Auditoria', actions: ['ver', 'exportar'] },
  { key: 'empleados', label: 'Empleados', actions: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'organizacion', label: 'Organizacion', actions: ['ver', 'crear', 'editar', 'eliminar', 'exportar'] },
  { key: 'importaciones', label: 'Importaciones', actions: ['ver', 'crear', 'exportar'] },
  { key: 'saas_consumo', label: 'SaaS y cobranza', actions: ['ver', 'exportar'] },
  { key: 'sucursales', label: 'Sucursales', actions: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'horarios', label: 'Horarios', actions: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'reportes', label: 'Reportes', actions: ['ver', 'exportar'] },
];

function defaultsForRole(role) {
  const all = Object.fromEntries(RESOURCES.map((resource) => [
    resource.key,
    Object.fromEntries(resource.actions.map((action) => [action, false])),
  ]));

  if (role === 'SUPER_ADMIN' || role === 'ADMIN_EMPRESA') {
    for (const resource of RESOURCES) {
      for (const action of resource.actions) all[resource.key][action] = true;
    }
  } else if (role === 'RRHH') {
    for (const resource of RESOURCES) {
      if (resource.key === 'cierres_mensuales') {
        all[resource.key].ver = true;
        all[resource.key].cerrar = true;
      } else if (resource.key === 'saas_consumo') {
        all[resource.key].ver = false;
      } else if (resource.key !== 'auditoria') {
        for (const action of resource.actions) all[resource.key][action] = action !== 'eliminar';
      }
    }
  } else if (role === 'EMPLEADO') {
    all.solicitudes.ver = true;
    all.solicitudes.crear = true;
  }

  return all;
}

function normalizePermissions(input = {}) {
  input = input || {};
  const normalized = {};
  for (const resource of RESOURCES) {
    if (!input[resource.key] || typeof input[resource.key] !== 'object') continue;
    normalized[resource.key] = {};
    for (const action of resource.actions) {
      if (typeof input[resource.key][action] === 'boolean') {
        normalized[resource.key][action] = input[resource.key][action];
      }
    }
  }
  return normalized;
}

function mergePermissions(role, rolePermissions = {}, userPermissions = {}) {
  const result = defaultsForRole(role);
  for (const source of [normalizePermissions(rolePermissions), normalizePermissions(userPermissions)]) {
    for (const [resource, actions] of Object.entries(source)) {
      result[resource] = { ...result[resource], ...actions };
    }
  }
  return result;
}

function hasPermission(auth, resource, action) {
  if (auth?.rol === 'SUPER_ADMIN') return true;
  return auth?.user?.permisos?.[resource]?.[action] === true;
}

function permissionGuard(resource, action) {
  return (req, res, next) => {
    if (!hasPermission(req.auth, resource, action)) {
      return res.status(403).json({ ok: false, message: `No tiene permiso para ${action} ${resource}` });
    }
    return next();
  };
}

module.exports = { ACTIONS, RESOURCES, defaultsForRole, hasPermission, mergePermissions, normalizePermissions, permissionGuard };
