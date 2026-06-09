import axios from 'axios';
import {
  EMPRESA_ID_KEY,
  getAccessToken,
  getRefreshToken,
  getStoredEmpresaId,
  clearStoredSession,
  saveSession,
} from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const authApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const empresaId = getStoredEmpresaId() || localStorage.getItem(EMPRESA_ID_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (empresaId) {
    config.headers['x-empresa-id'] = empresaId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const refreshToken = getRefreshToken();

    if (status === 401 && !originalRequest?._retry && !originalRequest?.url?.includes('/auth/refresh')) {
      originalRequest._retry = true;

      try {
        const response = await authApi.post('/auth/refresh', refreshToken ? { refreshToken } : {});
        const { user, tokens } = response.data.data;

        saveSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
        });

        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearStoredSession();
        window.location.assign('/login');
        return Promise.reject(refreshError);
      }
    }

    if (status === 401) {
      clearStoredSession();
      window.location.assign('/login');
    }

    return Promise.reject(error);
  },
);
