const authService = require('../services/auth.service');
const crypto = require('crypto');

const REFRESH_COOKIE_NAME = 'asistepro_refresh';
const CSRF_COOKIE_NAME = 'asistepro_csrf';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (!rawName) return cookies;

    cookies[rawName] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});
}

function getCookieOptions({ httpOnly = false, path = '/api/auth' } = {}) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  };
}

function getRefreshToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return {
    token: req.body?.refreshToken || cookies[REFRESH_COOKIE_NAME],
    source: req.body?.refreshToken ? 'body' : 'cookie',
    csrfToken: cookies[CSRF_COOKIE_NAME],
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getCookieOptions({ httpOnly: true }),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  res.cookie(CSRF_COOKIE_NAME, crypto.randomBytes(32).toString('hex'), {
    ...getCookieOptions({ path: '/' }),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions({ httpOnly: true }));
  res.clearCookie(CSRF_COOKIE_NAME, getCookieOptions({ path: '/' }));
}

function assertCsrfToken(req, refreshContext) {
  if (refreshContext.source !== 'cookie') return;

  const headerToken = req.headers['x-csrf-token'];
  if (!refreshContext.csrfToken || headerToken !== refreshContext.csrfToken) {
    const error = new Error('CSRF token invalido');
    error.statusCode = 403;
    throw error;
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Email y password son requeridos',
      });
    }

    const result = await authService.login({ email, password });
    setRefreshCookie(res, result.tokens.refreshToken);

    return res.json({
      ok: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshContext = getRefreshToken(req);
    assertCsrfToken(req, refreshContext);

    if (!refreshContext.token) {
      return res.status(400).json({
        ok: false,
        message: 'Refresh token requerido',
      });
    }

    const result = await authService.refresh(refreshContext.token);
    setRefreshCookie(res, result.tokens.refreshToken);

    return res.json({
      ok: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const refreshContext = getRefreshToken(req);
    assertCsrfToken(req, refreshContext);

    if (refreshContext.token) {
      await authService.revokeRefreshToken(refreshContext.token);
    }

    clearRefreshCookie(res);

    return res.json({
      ok: true,
      message: 'Sesion cerrada correctamente',
    });
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  return res.json({
    ok: true,
    data: req.auth.user,
  });
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.auth.usuario_id, req.body);

    return res.json({
      ok: true,
      message: 'Contrasena actualizada correctamente',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  changePassword,
};
