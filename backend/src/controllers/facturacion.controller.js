const facturacionService = require('../services/facturacion.service');
const { parsePagination } = require('../utils/pagination.util');

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

async function updateFactura(req, res, next) {
  try {
    const current = await facturacionService.findFacturaById(req.params.id);

    if (!current) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    if (!canAccessEmpresa(req, current.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede modificar esta factura' });
    }

    const factura = await facturacionService.updateFactura(req.params.id, req.body);
    return res.json({ ok: true, data: factura });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe una factura con ese numero';
    }

    return next(error);
  }
}

async function anularFactura(req, res, next) {
  try {
    const factura = await facturacionService.anulacionFactura(req.params.id, req.body?.motivo_anulacion);

    if (!factura) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    return res.json({ ok: true, data: factura });
  } catch (error) {
    return next(error);
  }
}

async function registerManualPayment(req, res, next) {
  try {
    const factura = await facturacionService.findFacturaById(req.body?.factura_id);

    if (!factura) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    if (!canAccessEmpresa(req, factura.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede pagar esta factura' });
    }

    const result = await facturacionService.registerManualPayment({
      ...req.body,
      estado: req.auth.rol === 'SUPER_ADMIN' ? 'registrado' : 'pendiente',
    });
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

async function getPago(req, res, next) {
  try {
    const pago = await facturacionService.findPagoById(req.params.id);

    if (!pago) {
      return res.status(404).json({ ok: false, message: 'Pago no encontrado' });
    }

    if (!canAccessEmpresa(req, pago.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede acceder a este pago' });
    }

    return res.json({ ok: true, data: pago });
  } catch (error) {
    return next(error);
  }
}

async function getPagoComprobante(req, res, next) {
  try {
    const comprobante = await facturacionService.findPagoComprobante(req.params.id);

    if (!comprobante) {
      return res.status(404).json({ ok: false, message: 'Pago no encontrado' });
    }

    if (!canAccessEmpresa(req, comprobante.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede acceder a este comprobante' });
    }

    if (!comprobante.comprobante_data) {
      return res.status(404).json({ ok: false, message: 'Comprobante no encontrado' });
    }

    const fileName = comprobante.comprobante_nombre || `comprobante-${comprobante.factura_numero || comprobante.id}`;

    res.setHeader('Content-Type', comprobante.comprobante_tipo || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    return res.send(comprobante.comprobante_data);
  } catch (error) {
    return next(error);
  }
}

async function aprobarPago(req, res, next) {
  try {
    const pago = await facturacionService.findPagoById(req.params.id);

    if (!pago) {
      return res.status(404).json({ ok: false, message: 'Pago no encontrado' });
    }

    if (!canAccessEmpresa(req, pago.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede aprobar este pago' });
    }

    const result = await facturacionService.aprobarPago(req.params.id);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function anularPago(req, res, next) {
  try {
    const pago = await facturacionService.findPagoById(req.params.id);

    if (!pago) {
      return res.status(404).json({ ok: false, message: 'Pago no encontrado' });
    }

    if (!canAccessEmpresa(req, pago.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede anular este pago' });
    }

    const result = await facturacionService.anulacionPago(req.params.id, req.body?.motivo_anulacion);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function getFacturaPdf(req, res, next) {
  try {
    const factura = await facturacionService.findFacturaPdf(req.params.id);

    if (!factura) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    if (!canAccessEmpresa(req, factura.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No puede acceder a esta factura' });
    }

    if (!factura.pdf_data) {
      return res.status(404).json({ ok: false, message: 'Archivo PDF no encontrado' });
    }

    const fileName = factura.pdf_nombre || `factura-${factura.numero || factura.id}.pdf`;

    res.setHeader('Content-Type', factura.pdf_tipo || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    return res.send(factura.pdf_data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listFacturas,
  getFactura,
  createFactura,
  updateFactura,
  anularFactura,
  getFacturaPdf,
  registerManualPayment,
  listPagos,
  getPago,
  getPagoComprobante,
  aprobarPago,
  anularPago,
};
