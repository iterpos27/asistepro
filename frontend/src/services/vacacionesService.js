import { api } from './api';

export async function listVacaciones(params = {}) {
  const response = await api.get('/vacaciones', { params });
  return response.data.data;
}

export async function getVacacionesEmpleado(empleadoId) {
  const response = await api.get(`/vacaciones/${empleadoId}`);
  return response.data.data;
}

export async function updateVacaciones(empleadoId, payload) {
  const response = await api.put(`/vacaciones/${empleadoId}`, payload);
  return response.data.data;
}
