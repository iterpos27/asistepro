import { api } from './api';
import { getRefreshToken } from '../utils/auth';

export async function login(credentials) {
  const response = await api.post('/auth/login', credentials);
  return response.data.data;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  await api.post('/auth/logout', { refreshToken });
}

export async function getProfile() {
  const response = await api.get('/auth/me');
  return response.data.data;
}

export async function refreshToken() {
  const response = await api.post('/auth/refresh', { refreshToken: getRefreshToken() });
  return response.data.data;
}
