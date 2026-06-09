export const ACCESS_TOKEN_KEY = 'asistepro_access_token';
export const REFRESH_TOKEN_KEY = 'asistepro_refresh_token';
export const USER_KEY = 'asistepro_user';
export const EMPRESA_ID_KEY = 'asistepro_empresa_id';

let accessTokenMemory = null;

export function getAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  return accessTokenMemory;
}

export function getRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  return null;
}

export function getCsrfToken() {
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('asistepro_csrf='))
    ?.split('=')
    .slice(1)
    .join('=');
}

export function saveSession({ accessToken, refreshToken, user }) {
  accessTokenMemory = accessToken || null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (user?.empresa_id) {
    localStorage.setItem(EMPRESA_ID_KEY, user.empresa_id);
  } else {
    localStorage.removeItem(EMPRESA_ID_KEY);
  }
}

export function getStoredEmpresaId() {
  const storedEmpresaId = localStorage.getItem(EMPRESA_ID_KEY);
  if (storedEmpresaId) return storedEmpresaId;

  const user = getStoredUser();
  if (user?.empresa_id) {
    localStorage.setItem(EMPRESA_ID_KEY, user.empresa_id);
    return user.empresa_id;
  }

  return null;
}

export function clearStoredSession() {
  accessTokenMemory = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EMPRESA_ID_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}
