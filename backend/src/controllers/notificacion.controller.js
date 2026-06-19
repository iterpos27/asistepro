const notificacionService = require('../services/notificacion.service');
const { parsePagination } = require('../utils/pagination.util');

async function listNotificaciones(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await notificacionService.listNotificaciones({
      usuarioId: req.auth.usuario_id,
      limit,
      offset,
    });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const notificacion = await notificacionService.markAsRead({
      notificacionId: id,
      usuarioId: req.auth.usuario_id,
    });

    if (!notificacion) {
      return res.status(404).json({ ok: false, message: 'Notificación no encontrada o no pertenece al usuario' });
    }

    return res.json({ ok: true, data: notificacion });
  } catch (error) {
    return next(error);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    await notificacionService.markAllAsRead({
      usuarioId: req.auth.usuario_id,
    });
    return res.json({ ok: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    return next(error);
  }
}

async function subscribePush(req, res, next) {
  try {
    const data = await notificacionService.savePushSubscription({
      usuarioId: req.auth.usuario_id,
      payload: req.body,
      userAgent: req.headers['user-agent'],
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listNotificaciones,
  markAsRead,
  markAllAsRead,
  subscribePush,
};
