import { api } from './api';

export async function listFeriados(params = {}) {
  const response = await api.get('/feriados', { params });
  // Backend returns { ok: true, data: { items: [], total: N } }
  return response.data.data;
}

export async function createFeriado(payload) {
  const response = await api.post('/feriados', payload);
  return response.data.data;
}

export async function deleteFeriado(id) {
  const response = await api.delete(`/feriados/${id}`);
  return response.data.data;
}
