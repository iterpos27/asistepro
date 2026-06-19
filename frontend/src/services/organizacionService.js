import { api } from './api';

export async function getSummary() {
  const response = await api.get('/organizacion/summary');
  return response.data.data;
}

export async function getCatalogs() {
  const response = await api.get('/organizacion/catalogos');
  return response.data.data;
}

export async function listStructures(params = {}) {
  const response = await api.get('/organizacion/estructuras', { params });
  return response.data.data;
}

export async function createStructure(payload) {
  const response = await api.post('/organizacion/estructuras', payload);
  return response.data.data;
}

export async function updateStructure(id, payload) {
  const response = await api.put(`/organizacion/estructuras/${id}`, payload);
  return response.data.data;
}

export async function deleteStructure(id) {
  const response = await api.delete(`/organizacion/estructuras/${id}`);
  return response.data.data;
}

export async function listImports() {
  const response = await api.get('/organizacion/importaciones');
  return response.data.data;
}

export async function importEmployees(payload) {
  const response = await api.post('/organizacion/importaciones/empleados', payload);
  return response.data.data;
}
