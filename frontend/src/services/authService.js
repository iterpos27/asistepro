import { api } from './api';
import { getRefreshToken } from '../utils/auth';

export async function login(credentials) {
  const response = await api.post('/auth/login', credentials);
  return response.data.data;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
}

export async function getProfile() {
  const response = await api.get('/auth/me');
  return response.data.data;
}

export async function refreshToken() {
  const storedRefreshToken = getRefreshToken();
  const response = await api.post('/auth/refresh', storedRefreshToken ? { refreshToken: storedRefreshToken } : {});
  return response.data.data;
}
