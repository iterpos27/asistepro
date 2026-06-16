import { api } from './api';

export async function listReemplazos({
  search = '',
  empleadoId = '',
  sucursalId = '',
  estado = '',
  fechaDesde = '',
  fechaHasta = '',
  limit = 100,
  offset = 0,
} = {}) {
  const response = await api.get('/reemplazos', {
    params: {
      search: search || undefined,
      empleado_id: empleadoId || undefined,
      sucursal_id: sucursalId || undefined,
      estado: estado || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      limit,
      offset,
    },
  });
  return response.data.data;
}

export async function createReemplazo(payload) {
  const response = await api.post('/reemplazos', payload);
  return response.data.data;
}

export async function updateReemplazo(id, payload) {
  const response = await api.put(`/reemplazos/${id}`, payload);
  return response.data.data;
}

export async function cancelReemplazo(id) {
  const response = await api.delete(`/reemplazos/${id}`);
  return response.data.data;
}
