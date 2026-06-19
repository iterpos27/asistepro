const { pool } = require('../config/database');

async function createNotificacion({ empresaId, usuarioId, titulo, mensaje, tipo }) {
  const result = await pool.query(
    `
    INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, tipo)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [empresaId, usuarioId, titulo, mensaje, tipo]
  );
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
  createMarcacionNovedadNotification,
};
