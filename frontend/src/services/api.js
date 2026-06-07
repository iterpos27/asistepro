import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('asistepro_access_token');
  const empresaId = localStorage.getItem('asistepro_empresa_id');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (empresaId) {
    config.headers['x-empresa-id'] = empresaId;
  }

  return config;
});

export function setSession({ accessToken, refreshToken, user }) {
  localStorage.setItem('asistepro_access_token', accessToken);
  localStorage.setItem('asistepro_refresh_token', refreshToken);
  localStorage.setItem('asistepro_user', JSON.stringify(user));

  if (user?.empresa_id) {
    localStorage.setItem('asistepro_empresa_id', user.empresa_id);
  }
}

export function clearSession() {
  localStorage.removeItem('asistepro_access_token');
  localStorage.removeItem('asistepro_refresh_token');
  localStorage.removeItem('asistepro_user');
  localStorage.removeItem('asistepro_empresa_id');
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('asistepro_user') || 'null');
  } catch {
    return null;
  }
}
