const horarioService = require('../services/horario.service');
const { parsePagination } = require('../utils/pagination.util');

function parseBoolean(value) {
  if (value === undefined) return undefined;
  return value === 'true' || value === true;
}

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function listHorarios(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await horarioService.listHorarios({
      empresaId: getEmpresaId(req),
      search: req.query.search,
      activo: parseBoolean(req.query.activo),
      sucursalId: req.query.sucursal_id,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getHorario(req, res, next) {
  try {
    const horario = await horarioService.findHorarioById(getEmpresaId(req), req.params.id);

    if (!horario) {
      return res.status(404).json({ ok: false, message: 'Horario no encontrado' });
    }

    return res.json({ ok: true, data: horario });
  } catch (error) {
    return next(error);
  }
}

async function createHorario(req, res, next) {
  try {
    const horario = await horarioService.createHorario(getEmpresaId(req), req.body);
    return res.status(201).json({ ok: true, data: horario });
  } catch (error) {
    return next(error);
  }
}

async function updateHorario(req, res, next) {
  try {
    const horario = await horarioService.updateHorario(getEmpresaId(req), req.params.id, req.body);

    if (!horario) {
      return res.status(404).json({ ok: false, message: 'Horario no encontrado' });
    }

    return res.json({ ok: true, data: horario });
  } catch (error) {
    return next(error);
  }
}

async function deleteHorario(req, res, next) {
  try {
    const horario = await horarioService.deactivateHorario(getEmpresaId(req), req.params.id);

    if (!horario) {
      return res.status(404).json({ ok: false, message: 'Horario no encontrado' });
    }

    return res.json({ ok: true, data: horario });
  } catch (error) {
    return next(error);
  }
}

async function listAsignaciones(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await horarioService.listEmpleadoHorarios({
      empresaId: getEmpresaId(req),
      empleadoId: req.query.empleado_id,
      activo: parseBoolean(req.query.activo),
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function assignHorario(req, res, next) {
  try {
    const assignment = await horarioService.assignHorario(getEmpresaId(req), req.body);
    return res.status(201).json({ ok: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

async function deleteAsignacion(req, res, next) {
  try {
    const assignment = await horarioService.deactivateEmpleadoHorario(getEmpresaId(req), req.params.id);

    if (!assignment) {
      return res.status(404).json({ ok: false, message: 'Asignacion no encontrada' });
    }

    return res.json({ ok: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listHorarios,
  getHorario,
  createHorario,
  updateHorario,
  deleteHorario,
  listAsignaciones,
  assignHorario,
  deleteAsignacion,
};
