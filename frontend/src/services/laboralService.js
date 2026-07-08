import { api } from './api';
export async function getCalculo(mes) { const response = await api.get(`/laboral/${mes}`); return response.data.data; }
export async function listCierres() { const response = await api.get('/laboral/cierres'); return response.data.data; }
export async function getReglasLaborales() { const response = await api.get('/laboral/reglas'); return response.data.data; }
export async function updateReglasLaborales(payload) { const response = await api.put('/laboral/reglas', payload); return response.data.data; }
export async function getAlertas(mes) { const response = await api.get(`/laboral/${mes}/alertas`); return response.data.data; }
export async function cerrarMes(mes) { const response = await api.post(`/laboral/${mes}/cerrar`); return response.data.data; }
export async function reabrirMes(mes, motivo) { const response = await api.post(`/laboral/${mes}/reabrir`, { motivo }); return response.data.data; }
export async function exportarCalculo(mes) { const response = await api.get(`/laboral/${mes}/export`, { responseType: 'blob' }); const url=URL.createObjectURL(response.data); const link=document.createElement('a'); link.href=url; link.download=`calculo-laboral-${mes}.csv`; link.click(); URL.revokeObjectURL(url); }
export async function exportarPrenomina(mes) { const response = await api.get(`/laboral/${mes}/export-prenomina`, { responseType: 'blob' }); const url=URL.createObjectURL(response.data); const link=document.createElement('a'); link.href=url; link.download=`resumen-financiero-laboral-${mes}.csv`; link.click(); URL.revokeObjectURL(url); }
export async function exportarResumenContable(mes) { const response = await api.get(`/laboral/${mes}/export-resumen-contable`, { responseType: 'blob' }); const url=URL.createObjectURL(response.data); const link=document.createElement('a'); link.href=url; link.download=`resumen-contable-laboral-${mes}.csv`; link.click(); URL.revokeObjectURL(url); }
