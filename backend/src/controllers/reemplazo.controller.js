const reemplazoService = require('../services/reemplazo.service');
const { parsePagination } = require('../utils/pagination.util');

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function listReemplazos(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query, { maxLimit: 200 });
    const result = await reemplazoService.listReemplazos({
      empresaId: getEmpresaId(req),
      empleadoId: req.query.empleado_id,
      sucursalId: req.query.sucursal_id,
      estado: req.query.estado,
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      search: req.query.search,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getReemplazo(req, res, next) {
  try {
    const reemplazo = await reemplazoService.findReemplazoById(getEmpresaId(req), req.params.id);
    if (!reemplazo) {
      return res.status(404).json({ ok: false, message: 'Reemplazo no encontrado' });
    }

    return res.json({ ok: true, data: reemplazo });
  } catch (error) {
    return next(error);
  }
}

async function createReemplazo(req, res, next) {
  try {
    const reemplazo = await reemplazoService.createReemplazo(getEmpresaId(req), req.auth, req.body);
    return res.status(201).json({ ok: true, data: reemplazo });
  } catch (error) {
    return next(error);
  }
}

async function updateReemplazo(req, res, next) {
  try {
    const reemplazo = await reemplazoService.updateReemplazo(getEmpresaId(req), req.params.id, req.body);
    if (!reemplazo) {
      return res.status(404).json({ ok: false, message: 'Reemplazo no encontrado' });
    }

    return res.json({ ok: true, data: reemplazo });
  } catch (error) {
    return next(error);
  }
}

async function cancelReemplazo(req, res, next) {
  try {
    const reemplazo = await reemplazoService.cancelReemplazo(getEmpresaId(req), req.params.id);
    if (!reemplazo) {
      return res.status(404).json({ ok: false, message: 'Reemplazo no encontrado' });
    }

    return res.json({ ok: true, data: reemplazo });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelReemplazo,
  createReemplazo,
  getReemplazo,
  listReemplazos,
  updateReemplazo,
};
