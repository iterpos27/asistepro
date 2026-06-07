const marcacionService = require('../services/marcacion.service');

function parsePagination(query) {
  const limit = Math.min(Number.parseInt(query.limit, 10) || 20, 100);
  const offset = Math.max(Number.parseInt(query.offset, 10) || 0, 0);

  return { limit, offset };
}

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function registrarMarcacion(req, res, next) {
  try {
    const result = await marcacionService.registrarMarcacion({
      empresaId: getEmpresaId(req),
      auth: req.auth,
      payload: req.body,
    });

    const statusCode = result.marcacion.estado === 'rechazada' ? 202 : 201;

    return res.status(statusCode).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function listMarcaciones(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await marcacionService.listMarcaciones({
      empresaId: getEmpresaId(req),
      empleadoId: req.query.empleado_id,
      sucursalId: req.query.sucursal_id,
      estado: req.query.estado,
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getMarcacion(req, res, next) {
  try {
    const marcacion = await marcacionService.findMarcacionById(getEmpresaId(req), req.params.id);

    if (!marcacion) {
      return res.status(404).json({ ok: false, message: 'Marcacion no encontrada' });
    }

    return res.json({ ok: true, data: marcacion });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registrarMarcacion,
  listMarcaciones,
  getMarcacion,
};
