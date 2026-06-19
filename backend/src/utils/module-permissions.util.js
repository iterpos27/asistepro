const MODULES = [
  { key: 'sucursales', label: 'Sucursales', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'empleados', label: 'Empleados', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'horarios', label: 'Horarios', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'reemplazos', label: 'Reemplazos', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'organizacion', label: 'Organizacion', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'importaciones', label: 'Importaciones', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'integraciones', label: 'Integraciones', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'marcaciones', label: 'Marcaciones', roles: ['ADMIN_EMPRESA', 'RRHH', 'EMPLEADO'] },
  { key: 'mis_marcaciones', label: 'Mis marcaciones', roles: ['ADMIN_EMPRESA', 'RRHH', 'EMPLEADO'] },
  { key: 'reportes_avanzados', label: 'Reportes', roles: ['ADMIN_EMPRESA', 'RRHH'] },
  { key: 'facturacion', label: 'Facturacion', roles: ['ADMIN_EMPRESA'] },
  { key: 'pwa_movil', label: 'App movil', roles: ['ADMIN_EMPRESA', 'RRHH', 'EMPLEADO'] },
];

const DEFAULT_ENABLED_MODULES = MODULES.reduce((acc, module) => {
  acc[module.key] = true;
  return acc;
}, {});

function normalizeModulePermissions(input = {}) {
  return Object.fromEntries(
    MODULES.filter((module) => typeof input[module.key] === 'boolean').map((module) => [
      module.key,
      input[module.key] === true,
    ]),
  );
}

function buildEffectiveModules({ empresaModules = {}, userModules = {}, role }) {
  const baseModules = { ...DEFAULT_ENABLED_MODULES, ...(empresaModules || {}) };
  const overrides = userModules || {};
  const allowedKeys = new Set(MODULES.filter((module) => module.roles.includes(role)).map((module) => module.key));
  const result = {};

  for (const module of MODULES) {
    if (!allowedKeys.has(module.key)) {
      result[module.key] = false;
      continue;
    }

    result[module.key] = overrides[module.key] === undefined ? baseModules[module.key] === true : overrides[module.key] === true;
  }

  return result;
}

module.exports = {
  MODULES,
  buildEffectiveModules,
  normalizeModulePermissions,
};
