export const ACCESS_TOKEN_KEY = 'asistepro_access_token';
export const REFRESH_TOKEN_KEY = 'asistepro_refresh_token';
export const USER_KEY = 'asistepro_user';
export const EMPRESA_ID_KEY = 'asistepro_empresa_id';
export const CSRF_TOKEN_KEY = 'asistepro_csrf_token';
export const SESSION_EXPIRES_AT_KEY = 'asistepro_session_expires_at';
export const EMPRESA_CHANGED_EVENT = 'asistepro:empresa-change';

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
  const cookieToken = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('asistepro_csrf='))
    ?.split('=')
    .slice(1)
    .join('=');

  return cookieToken || localStorage.getItem(CSRF_TOKEN_KEY);
}

export function saveSession({ accessToken, refreshToken, user, csrfToken, expiresInMs }) {
  accessTokenMemory = accessToken || null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (csrfToken) {
    localStorage.setItem(CSRF_TOKEN_KEY, csrfToken);
  }

  if (expiresInMs) {
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(Date.now() + Number(expiresInMs)));
  }

  if (user?.rol === 'SUPER_ADMIN') {
    if (user?.empresa_id) {
      localStorage.setItem(EMPRESA_ID_KEY, user.empresa_id);
    }
  } else {
    if (user?.empresa_id) {
      localStorage.setItem(EMPRESA_ID_KEY, user.empresa_id);
    } else {
      localStorage.removeItem(EMPRESA_ID_KEY);
    }
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

export function setStoredEmpresaId(empresaId) {
  if (empresaId) {
    localStorage.setItem(EMPRESA_ID_KEY, empresaId);
  } else {
    localStorage.removeItem(EMPRESA_ID_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(EMPRESA_CHANGED_EVENT, {
      detail: { empresaId: empresaId || null },
    }),
  );
}

export function clearStoredSession() {
  accessTokenMemory = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(CSRF_TOKEN_KEY);
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EMPRESA_ID_KEY);
}

export function getStoredUser() {
  const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY) || 0);
  if (expiresAt && expiresAt <= Date.now()) {
    clearStoredSession();
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}
