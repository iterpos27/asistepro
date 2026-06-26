const service = require('../services/vacaciones.service');
const { parsePagination } = require('../utils/pagination.util');

async function list(req, res, next) {
  try {
    const page = parsePagination(req.query, { maxLimit: 200 });
    const data = await service.listSaldos({
      empresaId: req.tenant.empresa_id,
      anio: req.query.anio,
      limit: page.limit,
      offset: page.offset,
    });
    return res.json({ ok: true, data });
  } catch (error) { next(error); }
}

async function getEmpleado(req, res, next) {
  try {
    const data = await service.getSaldoEmpleado(req.tenant.empresa_id, req.params.empleadoId);
    return res.json({ ok: true, data });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const anio = req.body.anio || new Date().getFullYear();
    const data = await service.updateSaldo(
      req.tenant.empresa_id,
      req.params.empleadoId,
      parseInt(anio, 10),
      req.body
    );
    return res.json({ ok: true, data });
  } catch (error) { next(error); }
}

module.exports = { list, getEmpleado, update };
