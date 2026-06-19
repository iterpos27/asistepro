const rateLimit = require('express-rate-limit');

function jsonRateLimitHandler(message) {
  return (req, res) => res.status(429).json({ ok: false, message });
}

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler('Demasiados intentos de inicio de sesion. Intenta nuevamente en 15 minutos.'),
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler('Se alcanzo el limite de registros. Intenta nuevamente mas tarde.'),
});

module.exports = {
  loginRateLimit,
  registerRateLimit,
};
