const sucursalService = require('../services/sucursal.service');
const { parsePagination } = require('../utils/pagination.util');

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function listSucursales(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await sucursalService.listSucursales({
      empresaId: getEmpresaId(req),
      search: req.query.search,
      estado: req.query.estado,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getSucursal(req, res, next) {
  try {
    const sucursal = await sucursalService.findSucursalById(getEmpresaId(req), req.params.id);

    if (!sucursal) {
      return res.status(404).json({ ok: false, message: 'Sucursal no encontrada' });
    }

    return res.json({ ok: true, data: sucursal });
  } catch (error) {
    return next(error);
  }
}

async function createSucursal(req, res, next) {
  try {
    const sucursal = await sucursalService.createSucursal(getEmpresaId(req), req.body);
    return res.status(201).json({ ok: true, data: sucursal });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una sucursal con ese codigo para esta empresa';
    }

    return next(error);
  }
}

async function updateSucursal(req, res, next) {
  try {
    const sucursal = await sucursalService.updateSucursal(getEmpresaId(req), req.params.id, req.body);

    if (!sucursal) {
      return res.status(404).json({ ok: false, message: 'Sucursal no encontrada' });
    }

    return res.json({ ok: true, data: sucursal });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una sucursal con ese codigo para esta empresa';
    }

    return next(error);
  }
}

async function deleteSucursal(req, res, next) {
  try {
    const sucursal = await sucursalService.deactivateSucursal(getEmpresaId(req), req.params.id);

    if (!sucursal) {
      return res.status(404).json({ ok: false, message: 'Sucursal no encontrada' });
    }

    return res.json({ ok: true, data: sucursal });
  } catch (error) {
    return next(error);
  }
}

async function getQr(req, res, next) {
  try {
    const sucursal = await sucursalService.findSucursalById(getEmpresaId(req), req.params.id);

    if (!sucursal) {
      return res.status(404).json({ ok: false, message: 'Sucursal no encontrada' });
    }

    return res.json({
      ok: true,
      data: {
        sucursal_id: sucursal.id,
        qr_token: sucursal.qr_token,
        qr_payload: sucursalService.buildQrPayload(sucursal),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function rotateQr(req, res, next) {
  try {
    const sucursal = await sucursalService.rotateQrToken(getEmpresaId(req), req.params.id);

    if (!sucursal) {
      return res.status(404).json({ ok: false, message: 'Sucursal no encontrada' });
    }

    return res.json({
      ok: true,
      data: {
        sucursal_id: sucursal.id,
        qr_token: sucursal.qr_token,
        qr_payload: sucursalService.buildQrPayload(sucursal),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function issueDynamicQr(req, res, next) {
  try {
    const result = await sucursalService.generateDynamicQrToken(getEmpresaId(req), req.params.id);

    if (!result) {
      return res.status(404).json({ ok: false, message: 'Sucursal activa no encontrada' });
    }

    return res.json({
      ok: true,
      data: {
        sucursal_id: result.sucursal.id,
        qr_token: result.token,
        expira_en: result.expira_en,
        ttl_seconds: result.ttl_seconds,
        qr_payload: result.qr_payload,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSucursales,
  getSucursal,
  createSucursal,
  updateSucursal,
  deleteSucursal,
  getQr,
  rotateQr,
  issueDynamicQr,
};
