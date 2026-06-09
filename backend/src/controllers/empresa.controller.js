const empresaService = require('../services/empresa.service');
const { parsePagination } = require('../utils/pagination.util');

function canAccessEmpresa(req, empresaId) {
  return req.auth.rol === 'SUPER_ADMIN' || req.auth.empresa_id === empresaId;
}

async function listEmpresas(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await empresaService.listEmpresas({
      search: req.query.search,
      estado: req.query.estado,
      limit,
      offset,
    });

    return res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getEmpresa(req, res, next) {
  try {
    const empresa = await empresaService.findEmpresaById(req.params.id);

    if (!empresa) {
      return res.status(404).json({
        ok: false,
        message: 'Empresa no encontrada',
      });
    }

    if (!canAccessEmpresa(req, empresa.id)) {
      return res.status(403).json({
        ok: false,
        message: 'No puede acceder a esta empresa',
      });
    }

    return res.json({
      ok: true,
      data: empresa,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMiEmpresa(req, res, next) {
  try {
    if (!req.auth.empresa_id) {
      return res.status(400).json({
        ok: false,
        message: 'El usuario no pertenece a una empresa',
      });
    }

    req.params.id = req.auth.empresa_id;
    return getEmpresa(req, res, next);
  } catch (error) {
    return next(error);
  }
}

async function createEmpresa(req, res, next) {
  try {
    const empresa = await empresaService.createEmpresa(req.body);

    return res.status(201).json({
      ok: true,
      data: empresa,
    });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una empresa con esos datos';
    }

    return next(error);
  }
}

async function updateEmpresa(req, res, next) {
  try {
    if (!canAccessEmpresa(req, req.params.id)) {
      return res.status(403).json({
        ok: false,
        message: 'No puede modificar esta empresa',
      });
    }

    const empresa = await empresaService.updateEmpresa(req.params.id, req.body);

    if (!empresa) {
      return res.status(404).json({
        ok: false,
        message: 'Empresa no encontrada',
      });
    }

    return res.json({
      ok: true,
      data: empresa,
    });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una empresa con esos datos';
    }

    return next(error);
  }
}

async function updateMiEmpresa(req, res, next) {
  req.params.id = req.auth.empresa_id;
  return updateEmpresa(req, res, next);
}

async function deleteEmpresa(req, res, next) {
  try {
    const empresa = await empresaService.deleteEmpresa(req.params.id);

    if (!empresa) {
      return res.status(404).json({
        ok: false,
        message: 'Empresa no encontrada',
      });
    }

    return res.json({
      ok: true,
      data: empresa,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listEmpresas,
  getEmpresa,
  getMiEmpresa,
  createEmpresa,
  updateEmpresa,
  updateMiEmpresa,
  deleteEmpresa,
};
