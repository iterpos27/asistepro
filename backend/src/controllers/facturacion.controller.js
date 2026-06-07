const facturacionService = require('../services/facturacion.service');

function parsePagination(query) {
  const limit = Math.min(Number.parseInt(query.limit, 10) || 20, 100);
  const offset = Math.max(Number.parseInt(query.offset, 10) || 0, 0);

  return { limit, offset };
}

function resolveEmpresaId(req) {
  return req.auth.rol === 'SUPER_ADMIN' ? req.query.empresa_id : req.auth.empresa_id;
}

function canAccessEmpresa(req, empresaId) {
  return req.auth.rol === 'SUPER_ADMIN' || req.auth.empresa_id === empresaId;
}

async function listFacturas(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await facturacionService.listFacturas({
      empresaId: resolveEmpresaId(req),
      estado: req.query.estado,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getFactura(req, res, next) {
  try {
    const factura = await facturacionService.findFacturaById(req.params.id);

    if (!factura) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    if (!canAccessEmpresa(req, factura.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede acceder a esta factura' });
    }

    return res.json({ ok: true, data: factura });
  } catch (error) {
    return next(error);
  }
}

async function createFactura(req, res, next) {
  try {
    const factura = await facturacionService.createFactura(req.body);
    return res.status(201).json({ ok: true, data: factura });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una factura con ese numero';
    }

    return next(error);
  }
}

async function registerManualPayment(req, res, next) {
  try {
    const result = await facturacionService.registerManualPayment(req.body);

    if (!canAccessEmpresa(req, result.factura.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede pagar esta factura' });
    }

    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function listPagos(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await facturacionService.listPagos({
      facturaId: req.query.factura_id,
      empresaId: resolveEmpresaId(req),
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listFacturas,
  getFactura,
  createFactura,
  registerManualPayment,
  listPagos,
};
