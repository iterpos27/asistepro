const authService = require('../services/auth.service');

const REFRESH_COOKIE_NAME = 'asistepro_refresh';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (!rawName) return cookies;

    cookies[rawName] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});
}

function getRefreshToken(req) {
  return req.body?.refreshToken || parseCookies(req.headers.cookie)[REFRESH_COOKIE_NAME];
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
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
    const refreshToken = getRefreshToken(req);

    if (!refreshToken) {
      return res.status(400).json({
        ok: false,
        message: 'Refresh token requerido',
      });
    }

    const result = await authService.refresh(refreshToken);
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
    const refreshToken = getRefreshToken(req);

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
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

module.exports = {
  login,
  refresh,
  logout,
  me,
};
