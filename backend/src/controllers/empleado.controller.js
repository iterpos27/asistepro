const empleadoService = require('../services/empleado.service');
const { parsePagination } = require('../utils/pagination.util');

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function listEmpleados(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await empleadoService.listEmpleados({
      empresaId: getEmpresaId(req),
      search: req.query.search,
      estado: req.query.estado,
      sucursalId: req.query.sucursal_id,
      areaId: req.query.area_id,
      supervisorId: req.query.supervisor_id,
      tipoContrato: req.query.tipo_contrato,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getEmpleado(req, res, next) {
  try {
    const empleado = await empleadoService.findEmpleadoById(getEmpresaId(req), req.params.id);

    if (!empleado) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado' });
    }

    return res.json({ ok: true, data: empleado });
  } catch (error) {
    return next(error);
  }
}

async function createEmpleado(req, res, next) {
  try {
    const empleado = await empleadoService.createEmpleado(getEmpresaId(req), req.body);
    return res.status(201).json({ ok: true, data: empleado });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe un empleado o usuario con ese codigo o email';
    }

    return next(error);
  }
}

async function updateEmpleado(req, res, next) {
  try {
    const empleado = await empleadoService.updateEmpleado(getEmpresaId(req), req.params.id, req.body);

    if (!empleado) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado' });
    }

    return res.json({ ok: true, data: empleado });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe un empleado o usuario con ese codigo o email';
    }

    return next(error);
  }
}

async function deleteEmpleado(req, res, next) {
  try {
    const empleado = await empleadoService.deactivateEmpleado(getEmpresaId(req), req.params.id);

    if (!empleado) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado' });
    }

    return res.json({ ok: true, data: empleado });
  } catch (error) {
    return next(error);
  }
}

async function liberarDispositivo(req, res, next) {
  try {
    const empleado = await empleadoService.updateEmpleado(getEmpresaId(req), req.params.id, { dispositivo_uuid: null });

    if (!empleado) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado' });
    }

    return res.json({ ok: true, message: 'Dispositivo liberado exitosamente', data: empleado });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listEmpleados,
  getEmpleado,
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  liberarDispositivo,
};
