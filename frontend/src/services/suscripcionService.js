import { api } from './api';

export async function listSuscripciones({ empresaId = '', estado = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/suscripciones', {
    params: {
      empresa_id: empresaId || undefined,
      estado: estado || undefined,
      limit,
      offset,
    },
  });
  return response.data.data;
}

export async function createSuscripcion(payload) {
  const response = await api.post('/suscripciones', payload);
  return response.data.data;
}

export async function updateSuscripcion(id, payload) {
  const response = await api.put(`/suscripciones/${id}`, payload);
  return response.data.data;
}

export async function deleteSuscripcion(id) {
  const response = await api.delete(`/suscripciones/${id}`);
  return response.data.data;
}

export async function solicitarUpgrade(planId) {
  const response = await api.post('/suscripciones/upgrade', { plan_id: planId });
  return response.data.data;
}
