import { api } from './api';
export async function listSolicitudes(params = {}) { const response = await api.get('/solicitudes', { params }); return response.data.data; }
export async function createSolicitud(payload) { const response = await api.post('/solicitudes', payload); return response.data.data; }
export async function reviewSolicitud(id, decision, comentario, datos_adicionales) { const response = await api.post(`/solicitudes/${id}/revisar`, { decision, comentario, datos_adicionales }); return response.data.data; }
export async function cancelSolicitud(id) { const response = await api.delete(`/solicitudes/${id}`); return response.data.data; }
export async function getCatalogs() { const response = await api.get('/solicitudes/catalogos'); return response.data.data; }
