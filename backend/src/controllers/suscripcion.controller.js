const suscripcionService = require('../services/suscripcion.service');
const { parsePagination } = require('../utils/pagination.util');

function canAccessEmpresa(req, empresaId) {
  return req.auth.rol === 'SUPER_ADMIN' || req.auth.empresa_id === empresaId;
}

async function listSuscripciones(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const empresaId = req.auth.rol === 'SUPER_ADMIN' ? req.query.empresa_id : req.auth.empresa_id;
    const result = await suscripcionService.listSuscripciones({
      empresaId,
      estado: req.query.estado,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getSuscripcion(req, res, next) {
  try {
    const suscripcion = await suscripcionService.findSuscripcionById(req.params.id);

    if (!suscripcion) {
      return res.status(404).json({ ok: false, message: 'Suscripcion no encontrada' });
    }

    if (!canAccessEmpresa(req, suscripcion.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede acceder a esta suscripcion' });
    }

    return res.json({ ok: true, data: suscripcion });
  } catch (error) {
    return next(error);
  }
}

async function createSuscripcion(req, res, next) {
  try {
    const suscripcion = await suscripcionService.createSuscripcion(req.body);
    return res.status(201).json({ ok: true, data: suscripcion });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'La empresa ya tiene una suscripcion activa';
    }

    return next(error);
  }
}

async function updateSuscripcion(req, res, next) {
  try {
    const current = await suscripcionService.findSuscripcionById(req.params.id);

    if (!current) {
      return res.status(404).json({ ok: false, message: 'Suscripcion no encontrada' });
    }

    if (!canAccessEmpresa(req, current.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede modificar esta suscripcion' });
    }

    const suscripcion = await suscripcionService.updateSuscripcion(req.params.id, req.body);
    return res.json({ ok: true, data: suscripcion });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'La empresa ya tiene una suscripcion activa';
    }

    return next(error);
  }
}

async function cancelSuscripcion(req, res, next) {
  try {
    const suscripcion = await suscripcionService.cancelSuscripcion(req.params.id);

    if (!suscripcion) {
      return res.status(404).json({ ok: false, message: 'Suscripcion no encontrada' });
    }

    return res.json({ ok: true, data: suscripcion });
  } catch (error) {
    return next(error);
  }
}
async function solicitarUpgrade(req, res, next) {
  try {
    const { plan_id } = req.body;
    const empresaId = req.auth.empresa_id;

    if (!empresaId) {
      return res.status(400).json({ ok: false, message: 'La empresa_id no esta disponible en el token' });
    }

    const result = await suscripcionService.solicitarUpgrade({
      empresaId,
      planId: plan_id,
    });

    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSuscripciones,
  getSuscripcion,
  createSuscripcion,
  updateSuscripcion,
  cancelSuscripcion,
  solicitarUpgrade,
};
