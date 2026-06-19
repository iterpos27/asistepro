import { api } from './api';

export async function listIntegraciones() {
  const response = await api.get('/integraciones');
  return response.data.data;
}

export async function createIntegracion(payload) {
  const response = await api.post('/integraciones', payload);
  return response.data.data;
}

export async function updateIntegracion(id, payload) {
  const response = await api.put(`/integraciones/${id}`, payload);
  return response.data.data;
}

export async function deleteIntegracion(id) {
  const response = await api.delete(`/integraciones/${id}`);
  return response.data.data;
}

export async function runIntegracion(id, payload = {}) {
  const response = await api.post(`/integraciones/${id}/run`, payload);
  return response.data.data;
}
