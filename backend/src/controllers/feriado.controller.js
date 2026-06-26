const service = require('../services/feriado.service');
const { parsePagination } = require('../utils/pagination.util');

async function list(req, res, next) {
  try {
    const page = parsePagination(req.query, { maxLimit: 200 });
    const data = await service.listFeriados({
      empresaId: req.tenant.empresa_id,
      activo: req.query.activo,
      anio: req.query.anio,
      limit: page.limit,
      offset: page.offset,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await service.createFeriado(req.tenant.empresa_id, req.body);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await service.updateFeriado(req.tenant.empresa_id, req.params.id, req.body);
    if (!data) {
      return res.status(404).json({ ok: false, message: 'Feriado no encontrado' });
    }
    return res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const data = await service.deleteFeriado(req.tenant.empresa_id, req.params.id);
    if (!data) {
      return res.status(404).json({ ok: false, message: 'Feriado no encontrado' });
    }
    return res.json({ ok: true, message: 'Feriado eliminado correctamente' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
};
