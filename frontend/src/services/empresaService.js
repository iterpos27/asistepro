import { api } from './api';

export async function listEmpresas({ search = '', estado = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/empresas', {
    params: {
      search: search || undefined,
      estado: estado || undefined,
      limit,
      offset,
    },
  });

  return response.data.data;
}

export async function createEmpresa(payload) {
  const response = await api.post('/empresas', payload);
  return response.data.data;
}

export async function updateEmpresa(id, payload) {
  const response = await api.put(`/empresas/${id}`, payload);
  return response.data.data;
}

export async function deleteEmpresa(id) {
  const response = await api.delete(`/empresas/${id}`);
  return response.data.data;
}

export async function resetAdminPassword(id) {
  const response = await api.post(`/empresas/${id}/reset-admin-password`);
  return response.data.data;
}
