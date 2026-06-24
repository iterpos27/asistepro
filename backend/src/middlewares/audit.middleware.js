const { pool } = require('../config/database');

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEYS = new Set([
  'accessToken',
  'authorization',
  'comprobante',
  'comprobante_base64',
  'password',
  'password_acceso',
  'password_hash',
  'refreshToken',
  'token',
  'archivo_base64',
  'data_base64',
  'file_base64',
  'base64',
  'secret',
  'signature',
  'credential',
]);

const SENSITIVE_PATTERNS = [
  'password',
  'passphrase',
  'contrasena',
  'contraseñ',
  'clave',
  'token',
  'secret',
  'credential',
  'signature',
  'base64',
  'hash',
  'jwt',
  'auth',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'secretkey',
  'secret_key',
  'accesskey',
  'access_key',
  'payload',
  'otp',
  'mfa',
];

const ROUTE_MODULES = {
  auth: 'Seguridad y Acceso',
  empleados: 'Gestión de Empleados',
  empresas: 'Gestión de Empresas',
  facturacion: 'Facturación',
  health: 'Estado del Sistema',
  horarios: 'Gestión de Horarios',
  integraciones: 'Integraciones',
  marcaciones: 'Control de Asistencia',
  organizacion: 'Estructura Organizacional',
  planes: 'Planes de Suscripción',
  reportes: 'Reportes y Estadísticas',
  reemplazos: 'Reemplazos y Coberturas',
  saas: 'Administración SaaS',
  notificaciones: 'Notificaciones',
  suscripciones: 'Suscripciones',
  sucursales: 'Gestión de Sucursales',
  tenant: 'Configuración de Empresa',
  usuarios: 'Gestión de Usuarios',
  laboral: 'Configuración Laboral',
  solicitudes: 'Solicitudes y Permisos',
  auditoria: 'Auditoría de Cambios',
};

function isSensitiveKey(key) {
  if (!key || typeof key !== 'string') return false;
  const lowerKey = key.toLowerCase();
  
  if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(lowerKey)) {
    return true;
  }
  
  for (const pattern of SENSITIVE_PATTERNS) {
    if (lowerKey.includes(pattern)) {
      return true;
    }
  }
  
  if (lowerKey === 'pin' || lowerKey.startsWith('pin_') || lowerKey.endsWith('_pin')) {
    return true;
  }
  
  return false;
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((safe, [key, entry]) => {
      if (isSensitiveKey(key)) {
        safe[key] = '[redacted]';
        return safe;
      }

      safe[key] = sanitizeValue(entry);
      return safe;
    }, {});
  }

  if (typeof value === 'string' && value.length > 240) {
    return `${value.slice(0, 240)}...`;
  }

  return value;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveEntity(req) {
  const urlPath = (req.originalUrl || '').split('?')[0];
  const parts = urlPath.split('/').filter(Boolean);
  const offset = parts[0] === 'api' ? 1 : 0;
  
  let entidad = parts[offset] || 'api';
  let entidad_id = null;

  if (parts.length > 0) {
    const lastSegment = parts[parts.length - 1];
    if (UUID_REGEX.test(lastSegment)) {
      entidad_id = lastSegment;
      const entityIndex = parts.length - 2;
      if (entityIndex >= offset) {
        entidad = parts[entityIndex];
      }
    } else {
      entidad_id = req.params?.id || null;
    }
  }

  return { entidad, entidad_id };
}

function getFriendlyRouteAndAction(req, cleanRuta, method, entidad) {
  const parts = cleanRuta.split('/').filter(Boolean);
  const firstSegment = parts[0] === 'api' ? parts[1] : parts[0];
  
  const friendlyRoute = ROUTE_MODULES[firstSegment] || firstSegment || 'Sistema';
  
  let friendlyAction = '';
  const methodUpper = (method || '').toUpperCase();
  const entidadName = entidad || firstSegment || 'recurso';
  const entidadCapitalized = entidadName.charAt(0).toUpperCase() + entidadName.slice(1);

  if (cleanRuta.includes('/auth/login')) {
    friendlyAction = 'Inicio de sesión';
  } else if (cleanRuta.includes('/auth/logout')) {
    friendlyAction = 'Cierre de sesión';
  } else if (cleanRuta.includes('/auth/refresh')) {
    friendlyAction = 'Renovación de sesión';
  } else if (cleanRuta.includes('/qr/dynamic')) {
    friendlyAction = 'Generación de QR Dinámico';
  } else if (cleanRuta.includes('/qr/rotate')) {
    friendlyAction = 'Rotación de QR';
  } else {
    switch (methodUpper) {
      case 'POST':
        friendlyAction = `Creación de ${entidadCapitalized}`;
        break;
      case 'PUT':
      case 'PATCH':
        friendlyAction = `Modificación de ${entidadCapitalized}`;
        break;
      case 'DELETE':
        friendlyAction = `Eliminación de ${entidadCapitalized}`;
        break;
      default:
        friendlyAction = `${methodUpper} - ${entidadCapitalized}`;
    }
  }

  return { friendlyRoute, friendlyAction };
}

function auditLogger(req, res, next) {
  if (!AUDITED_METHODS.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 500) return;

    const { entidad, entidad_id } = resolveEntity(req);
    const empresaId = req.tenant?.empresa_id || req.auth?.empresa_id || null;
    const usuarioId = req.auth?.usuario_id || null;
    const cleanRuta = (req.originalUrl || '').split('?')[0];

    const { friendlyRoute, friendlyAction } = getFriendlyRouteAndAction(req, cleanRuta, req.method, entidad);

    pool
      .query(
        `
          INSERT INTO logs_auditoria (
            empresa_id,
            usuario_id,
            accion,
            entidad,
            entidad_id,
            metodo,
            ruta,
            ip,
            user_agent,
            estado_http,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11)
        `,
        [
          empresaId,
          usuarioId,
          friendlyAction,
          entidad,
          entidad_id,
          req.method,
          friendlyRoute,
          req.ip,
          req.get('user-agent') || null,
          res.statusCode,
          JSON.stringify({
            params: sanitizeValue(req.params || {}),
            query: sanitizeValue(req.query || {}),
            body: sanitizeValue(req.body || {}),
            actor: {
              rol: req.auth?.rol || null,
              email: req.auth?.user?.email || null,
            },
          }),
        ],
      )
      .catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Audit log failed]', error.message);
        }
      });
  });

  return next();
}

module.exports = {
  auditLogger,
};
