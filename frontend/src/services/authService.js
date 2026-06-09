import { api } from './api';

export async function login(credentials) {
  const response = await api.post('/auth/login', credentials);
  return response.data.data;
}

export async function logout() {
  await api.post('/auth/logout', {});
}

export async function getProfile() {
  const response = await api.get('/auth/me');
  return response.data.data;
}

export async function refreshToken() {
  const response = await api.post('/auth/refresh', {});
  return response.data.data;
}

export async function changePassword(payload) {
  const response = await api.put('/auth/password', payload);
  return response.data;
}
