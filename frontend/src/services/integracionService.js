import { api } from './api';

export async function listUsuariosBiometrico(id, fechaDesde) {
  const response = await api.get(`/integraciones/${id}/usuarios-biometrico`, { params: { fecha_desde: fechaDesde }, timeout: 120000 });
  return response.data.data;
}

export async function vincularUsuarioBiometrico(id, payload) {
  const response = await api.post(`/integraciones/${id}/usuarios-biometrico/vincular`, payload, { timeout: 180000 });
  return response.data.data;
}

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

export async function downloadIntegracion(id, payload = {}) {
  const response = await api.post(`/integraciones/${id}/download`, payload, {
    responseType: 'blob',
  });
  return {
    blob: response.data,
    fileName:
      response.headers['content-disposition']
        ?.split('filename=')
        ?.pop()
        ?.replace(/"/g, '')
        ?.trim() || 'integracion-export.csv',
  };
}
