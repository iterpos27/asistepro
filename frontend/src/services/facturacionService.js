import { api } from './api';

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export async function listFacturas({ empresaId = '', estado = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/facturacion/facturas', {
    params: cleanParams({
      empresa_id: empresaId,
      estado,
      limit,
      offset,
    }),
  });
  return response.data.data;
}

export async function createFactura(payload) {
  const response = await api.post('/facturacion/facturas', payload);
  return response.data.data;
}

export async function updateFactura(id, payload) {
  const response = await api.put(`/facturacion/facturas/${id}`, payload);
  return response.data.data;
}

export async function anularFactura(id, motivoAnulacion) {
  const response = await api.delete(`/facturacion/facturas/${id}`, {
    data: { motivo_anulacion: motivoAnulacion || undefined },
  });
  return response.data.data;
}

export async function listPagos({ facturaId = '', empresaId = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/facturacion/pagos', {
    params: cleanParams({
      factura_id: facturaId,
      empresa_id: empresaId,
      limit,
      offset,
    }),
  });
  return response.data.data;
}

export async function registerManualPayment(payload) {
  const response = await api.post('/facturacion/pagos/manual', payload);
  return response.data.data;
}

export async function aprobarPago(id) {
  const response = await api.post(`/facturacion/pagos/${id}/aprobar`);
  return response.data.data;
}

export async function getPagoComprobante(id) {
  const response = await api.get(`/facturacion/pagos/${id}/comprobante`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function anularPago(id, motivoAnulacion) {
  const response = await api.delete(`/facturacion/pagos/${id}`, {
    data: { motivo_anulacion: motivoAnulacion || undefined },
  });
  return response.data.data;
}

export async function getFacturaPdf(id) {
  const response = await api.get(`/facturacion/facturas/${id}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
}
