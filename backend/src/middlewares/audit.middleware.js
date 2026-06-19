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
]);

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((safe, [key, entry]) => {
      if (SENSITIVE_KEYS.has(key) || key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
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

function resolveEntity(req) {
  const parts = req.path.split('/').filter(Boolean);
  const offset = parts[0] === 'api' ? 1 : 0;
  return {
    entidad: parts[offset] || 'api',
    entidad_id: req.params?.id || null,
  };
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
          `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path}`,
          entidad,
          entidad_id,
          req.method,
          req.originalUrl,
          req.ip,
          req.get('user-agent') || null,
          res.statusCode,
          JSON.stringify({
            params: req.params || {},
            query: req.query || {},
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
