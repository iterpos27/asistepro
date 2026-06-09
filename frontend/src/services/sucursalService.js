import { api } from './api';

export async function listSucursales({ search = '', estado = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/sucursales', {
    params: {
      search: search || undefined,
      estado: estado || undefined,
      limit,
      offset,
    },
  });
  return response.data.data;
}

export async function createSucursal(payload) {
  const response = await api.post('/sucursales', payload);
  return response.data.data;
}

export async function updateSucursal(id, payload) {
  const response = await api.put(`/sucursales/${id}`, payload);
  return response.data.data;
}

export async function deleteSucursal(id) {
  const response = await api.delete(`/sucursales/${id}`);
  return response.data.data;
}

export async function getSucursalQr(id) {
  const response = await api.get(`/sucursales/${id}/qr`);
  return response.data.data;
}

export async function rotateSucursalQr(id) {
  const response = await api.post(`/sucursales/${id}/qr/rotate`);
  return response.data.data;
}

export async function issueDynamicSucursalQr(id) {
  const response = await api.post(`/sucursales/${id}/qr/dynamic`);
  return response.data.data;
}
