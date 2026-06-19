import { api } from './api';

export async function listNotificaciones({ limit = 20, offset = 0 } = {}) {
  const response = await api.get('/notificaciones', {
    params: { limit, offset },
  });
  return response.data.data;
}

export async function markAsRead(id) {
  const response = await api.put(`/notificaciones/${id}/read`);
  return response.data.data;
}

export async function markAllAsRead() {
  const response = await api.put('/notificaciones/read-all');
  return response.data.message;
}

export async function subscribePush(payload) {
  const response = await api.post('/notificaciones/subscribe', payload);
  return response.data.data;
}
