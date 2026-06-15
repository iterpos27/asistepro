import { api } from './api';

export async function listHorarios({ search = '', activo = '', sucursalId = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/horarios', {
    params: {
      search: search || undefined,
      activo: activo === '' ? undefined : activo,
      sucursal_id: sucursalId || undefined,
      limit,
      offset,
    },
  });
  return response.data.data;
}

export async function createHorario(payload) {
  const response = await api.post('/horarios', payload);
  return response.data.data;
}

export async function updateHorario(id, payload) {
  const response = await api.put(`/horarios/${id}`, payload);
  return response.data.data;
}

export async function deleteHorario(id) {
  const response = await api.delete(`/horarios/${id}`);
  return response.data.data;
}

export async function listAsignaciones({ empleadoId = '', activo = '', limit = 100, offset = 0 } = {}) {
  const response = await api.get('/horarios/asignaciones', {
    params: {
      empleado_id: empleadoId || undefined,
      activo: activo === '' ? undefined : activo,
      limit,
      offset,
    },
  });
  return response.data.data;
}

export async function assignHorario(payload) {
  const response = await api.post('/horarios/asignaciones', payload);
  return response.data.data;
}

export async function deleteAsignacion(id) {
  const response = await api.delete(`/horarios/asignaciones/${id}`);
  return response.data.data;
}
