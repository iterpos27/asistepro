import { api } from './api';

function compactParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export async function getAsistenciaDiaria({ fecha, sucursalId, empleadoId, estado } = {}) {
  const response = await api.get('/reportes/asistencia-diaria', {
    params: compactParams({
      fecha,
      sucursal_id: sucursalId,
      empleado_id: empleadoId,
      estado,
    }),
  });
  return response.data.data;
}

export async function getAsistenciaMensual({ mes, sucursalId, empleadoId, estado } = {}) {
  const response = await api.get('/reportes/asistencia-mensual', {
    params: compactParams({
      mes,
      sucursal_id: sucursalId,
      empleado_id: empleadoId,
      estado,
    }),
  });
  return response.data.data;
}

export async function getNovedades({ fechaDesde, fechaHasta, sucursalId, empleadoId, limit = 100, offset = 0 } = {}) {
  const response = await api.get('/reportes/novedades', {
    params: compactParams({
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      sucursal_id: sucursalId,
      empleado_id: empleadoId,
      limit,
      offset,
    }),
  });
  return response.data.data;
}

export async function getAtrasos({ fechaDesde, fechaHasta, sucursalId, empleadoId, limit = 100, offset = 0 } = {}) {
  const response = await api.get('/reportes/atrasos', {
    params: compactParams({
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      sucursal_id: sucursalId,
      empleado_id: empleadoId,
      limit,
      offset,
    }),
  });
  return response.data.data;
}

export async function downloadCsv(path, params, filename) {
  const response = await api.get(path, {
    params: compactParams(params),
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
