import { api } from './api';

export async function listEmpleados({
  search = '',
  estado = '',
  sucursalId = '',
  areaId = '',
  supervisorId = '',
  tipoContrato = '',
  limit = 100,
  offset = 0,
} = {}) {
  const response = await api.get('/empleados', {
    params: {
      search: search || undefined,
      estado: estado || undefined,
      sucursal_id: sucursalId || undefined,
      area_id: areaId || undefined,
      supervisor_id: supervisorId || undefined,
      tipo_contrato: tipoContrato || undefined,
      limit,
      offset,
    },
  });
  return response.data.data;
}

export async function getEmpleado(id) {
  const response = await api.get(`/empleados/${id}`);
  return response.data.data;
}

export async function createEmpleado(payload) {
  const response = await api.post('/empleados', payload);
  return response.data.data;
}

export async function updateEmpleado(id, payload) {
  const response = await api.put(`/empleados/${id}`, payload);
  return response.data.data;
}

export async function deleteEmpleado(id) {
  const response = await api.delete(`/empleados/${id}`);
  return response.data.data;
}
