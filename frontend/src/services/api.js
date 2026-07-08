import axios from 'axios';
import {
  EMPRESA_ID_KEY,
  getAccessToken,
  getCsrfToken,
  getStoredEmpresaId,
  clearStoredSession,
  saveSession,
} from '../utils/auth';
import { toast } from './toastService';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4001/api');

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

  const method = (config.method || 'get').toLowerCase();
  const csrfToken = getCsrfToken();
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers['x-csrf-token'] = decodeURIComponent(csrfToken);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isLoginRequest = originalRequest?.url?.includes('/auth/login');
    const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');

    if (status === 401 && !originalRequest?._retry && !isRefreshRequest && !isLoginRequest) {
      originalRequest._retry = true;

      try {
        const csrfToken = getCsrfToken();
        const response = await authApi.post(
          '/auth/refresh',
          {},
          csrfToken ? { headers: { 'x-csrf-token': decodeURIComponent(csrfToken) } } : {},
        );
        const { user, tokens } = response.data.data;

        saveSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          csrfToken: response.data.data.session?.csrfToken,
          expiresInMs: response.data.data.session?.expiresInMs,
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

    if (status === 401 && !isLoginRequest) {
      clearStoredSession();
      window.location.assign('/login');
    }

    if (!isRefreshRequest && !originalRequest?.skipToast) {
      if (status && (status !== 401 || isLoginRequest)) {
        toast.error(error.response?.data?.message || 'No se pudo completar la operacion');
      } else if (!status) {
        toast.warning('No hay conexion con el servidor');
      }
    }

    return Promise.reject(error);
  },
);
