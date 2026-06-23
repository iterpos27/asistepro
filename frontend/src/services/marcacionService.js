import { api } from './api';

export async function registrarMarcacion(payload) {
  const response = await api.post('/marcaciones', payload);
  return response.data.data;
}

export async function listMarcaciones({
  empleadoId = '',
  sucursalId = '',
  estado = '',
  fechaDesde = '',
  fechaHasta = '',
  soloMios = false,
  limit = 100,
  offset = 0,
} = {}) {
  const response = await api.get('/marcaciones', {
    params: {
      empleado_id: empleadoId || undefined,
      sucursal_id: sucursalId || undefined,
      estado: estado || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      solo_mios: soloMios || undefined,
      limit,
      offset,
    },
  });
  return response.data.data;
}
