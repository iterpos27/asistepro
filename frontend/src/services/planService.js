import { api } from './api';

export async function listPlanes({ incluirInactivos = true } = {}) {
  const response = await api.get('/planes', {
    params: { incluir_inactivos: incluirInactivos ? 'true' : undefined },
  });
  return response.data.data;
}

export async function createPlan(payload) {
  const response = await api.post('/planes', payload);
  return response.data.data;
}

export async function updatePlan(id, payload) {
  const response = await api.put(`/planes/${id}`, payload);
  return response.data.data;
}

export async function deletePlan(id) {
  const response = await api.delete(`/planes/${id}`);
  return response.data.data;
}

export async function listPublicPlanes() {
  const response = await api.get('/planes/public');
  return response.data.data;
}
