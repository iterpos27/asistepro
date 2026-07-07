const crypto = require('crypto');
const https = require('https');
const { pool } = require('../config/database');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function buildVapidPrivateKey() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!privateKey || !publicKey) return null;

  if (privateKey.includes('BEGIN')) return privateKey;

  const publicBuffer = Buffer.from(publicKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (publicBuffer.length !== 65 || publicBuffer[0] !== 4) return null;

  return crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateKey,
      x: base64url(publicBuffer.subarray(1, 33)),
      y: base64url(publicBuffer.subarray(33, 65)),
    },
    format: 'jwk',
  });
}

function createVapidJwt(endpoint) {
  const privateKey = buildVapidPrivateKey();
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!privateKey || !publicKey) return null;

  const aud = new URL(endpoint).origin;
  const subject = process.env.VAPID_SUBJECT || process.env.FRONTEND_URL || 'mailto:soporte@asistepro.local';
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64url(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return {
    publicKey,
    token: `${signingInput}.${base64url(signature)}`,
  };
}

function sendEmptyPush(subscription) {
  return new Promise((resolve) => {
    let vapid;
    try {
      vapid = createVapidJwt(subscription.endpoint);
    } catch {
      resolve(false);
      return;
    }

    if (!vapid) {
      resolve(false);
      return;
    }

    const url = new URL(subscription.endpoint);
    const request = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          Authorization: `vapid t=${vapid.token}, k=${vapid.publicKey}`,
          TTL: '60',
          'Content-Length': '0',
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 300);
      },
    );

    request.on('error', () => resolve(false));
    request.end();
  });
}

async function notifyPushSubscribers(usuarioId) {
  const result = await pool.query(
    `
      SELECT id, endpoint
      FROM notificaciones_push_suscripciones
      WHERE usuario_id = $1
        AND activo = TRUE
      ORDER BY actualizado_en DESC
      LIMIT 5
    `,
    [usuarioId],
  );

  for (const subscription of result.rows) {
    const delivered = await sendEmptyPush(subscription);
    if (!delivered && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY) {
      await pool.query(
        `UPDATE notificaciones_push_suscripciones SET activo = FALSE, actualizado_en = NOW() WHERE id = $1`,
        [subscription.id],
      );
    }
  }
}

async function createNotificacion({ empresaId, usuarioId, titulo, mensaje, tipo }) {
  const result = await pool.query(
    `
    INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, tipo)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [empresaId, usuarioId, titulo, mensaje, tipo]
  );
  notifyPushSubscribers(usuarioId).catch(() => {});
  return result.rows[0];
}

async function listNotificaciones({ usuarioId, limit = 20, offset = 0 }) {
  const result = await pool.query(
    `
    SELECT *, COUNT(*) OVER() as total
    FROM notificaciones
    WHERE usuario_id = $1
    ORDER BY creado_en DESC
    LIMIT $2 OFFSET $3
    `,
    [usuarioId, limit, offset]
  );

  const total = result.rows[0] ? parseInt(result.rows[0].total) : 0;
  const items = result.rows.map(({ total, ...item }) => item);

  return { items, total };
}

async function markAsRead({ notificacionId, usuarioId }) {
  const result = await pool.query(
    `
    UPDATE notificaciones
    SET leido = TRUE
    WHERE id = $1 AND usuario_id = $2
    RETURNING *
    `,
    [notificacionId, usuarioId]
  );
  return result.rows[0] || null;
}

async function markAllAsRead({ usuarioId }) {
  await pool.query(
    `
    UPDATE notificaciones
    SET leido = TRUE
    WHERE usuario_id = $1 AND leido = FALSE
    `,
    [usuarioId]
  );
  return true;
}

async function savePushSubscription({ usuarioId, payload, userAgent }) {
  const endpoint = String(payload?.endpoint || '').trim();
  const p256dh = String(payload?.keys?.p256dh || '').trim();
  const auth = String(payload?.keys?.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    const error = new Error('Suscripcion push invalida');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      INSERT INTO notificaciones_push_suscripciones (usuario_id, endpoint, p256dh, auth, user_agent, activo)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (endpoint)
      DO UPDATE SET usuario_id = EXCLUDED.usuario_id,
                    p256dh = EXCLUDED.p256dh,
                    auth = EXCLUDED.auth,
                    user_agent = EXCLUDED.user_agent,
                    activo = TRUE,
                    actualizado_en = NOW()
      RETURNING id, endpoint, activo, creado_en, actualizado_en
    `,
    [usuarioId, endpoint, p256dh, auth, userAgent || null],
  );

  return result.rows[0];
}

async function createMarcacionNovedadNotification({ empresaId, empleadoNombre, sucursalNombre, motivo }) {
  // Buscar todos los usuarios ADMIN_EMPRESA y RRHH activos de la empresa
  const admins = await pool.query(
    `
    SELECT u.id 
    FROM usuarios u
    INNER JOIN roles r ON r.id = u.rol_id
    WHERE u.empresa_id = $1 
      AND r.codigo IN ('ADMIN_EMPRESA', 'RRHH')
      AND u.estado = 'activo'
    `,
    [empresaId]
  );

  const titulo = 'Marcación con novedad';
  const mensaje = `${empleadoNombre} realizó una marcación en la sucursal ${sucursalNombre} con la novedad: "${motivo}".`;

  for (const admin of admins.rows) {
    await createNotificacion({
      empresaId,
      usuarioId: admin.id,
      titulo,
      mensaje,
      tipo: 'marcacion_novedad',
    });
  }
}

module.exports = {
  createNotificacion,
  listNotificaciones,
  markAsRead,
  markAllAsRead,
  savePushSubscription,
  notifyPushSubscribers,
  createMarcacionNovedadNotification,
};
