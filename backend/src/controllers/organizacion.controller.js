const organizacionService = require('../services/organizacion.service');
const tenantService = require('../services/tenant.service');

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function summary(req, res, next) {
  try {
    const data = await organizacionService.getSummary(getEmpresaId(req));
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function listStructures(req, res, next) {
  try {
    const data = await organizacionService.listStructures({
      empresaId: getEmpresaId(req),
      tipo: req.query.tipo,
      activo: req.query.activo === undefined ? true : req.query.activo === 'true' || req.query.activo === true,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function catalogs(req, res, next) {
  try {
    const data = await organizacionService.getCatalogs(getEmpresaId(req));
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function createStructure(req, res, next) {
  try {
    const data = await organizacionService.saveStructure(getEmpresaId(req), req.body);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una estructura con ese codigo y tipo';
    }
    return next(error);
  }
}

async function updateStructure(req, res, next) {
  try {
    const data = await organizacionService.saveStructure(getEmpresaId(req), req.body, req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Estructura no encontrada' });
    return res.json({ ok: true, data });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una estructura con ese codigo y tipo';
    }
    return next(error);
  }
}

async function deleteStructure(req, res, next) {
  try {
    const data = await organizacionService.deactivateStructure(getEmpresaId(req), req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Estructura no encontrada' });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function listImports(req, res, next) {
  try {
    const data = await organizacionService.listImports(getEmpresaId(req));
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function importEmployees(req, res, next) {
  try {
    await tenantService.assertMonthlyImportsCapacity({
      empresaId: getEmpresaId(req),
      plan: req.tenant.subscription,
      includeNew: 1,
    });
    const data = await organizacionService.importEmployeesFromExcel({
      empresaId: getEmpresaId(req),
      usuarioId: req.auth.usuario_id,
      fileBase64: req.body.archivo_base64,
      filename: req.body.nombre_archivo,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'La importacion contiene codigos o correos duplicados';
    }
    return next(error);
  }
}

module.exports = {
  catalogs,
  createStructure,
  deleteStructure,
  importEmployees,
  listImports,
  listStructures,
  summary,
  updateStructure,
};
