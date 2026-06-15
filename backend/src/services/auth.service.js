const bcrypt = require('bcryptjs');

const { pool } = require('../config/database');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshExpiration,
} = require('../config/jwt');
const { hashToken } = require('../utils/token.util');

function sanitizeUser(user) {
  return {
    id: user.id,
    empresa_id: user.empresa_id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    estado: user.estado,
    rol: user.rol_codigo,
    empresa: user.empresa_nombre,
    modulos: user.configuracion_modulos || {},
  };
}

async function findUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.empresa_id,
        u.rol_id,
        u.nombre,
        u.apellido,
        u.email,
        u.password_hash,
        u.estado,
        r.codigo AS rol_codigo,
        e.nombre AS empresa_nombre,
        e.configuracion_modulos
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.empresa_id,
        u.rol_id,
        u.nombre,
        u.apellido,
        u.email,
        u.estado,
        r.codigo AS rol_codigo,
        e.nombre AS empresa_nombre,
        e.configuracion_modulos
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE u.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function persistRefreshToken(userId, refreshToken) {
  await pool.query(
    `
      INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en)
      VALUES ($1, $2, $3)
    `,
    [userId, hashToken(refreshToken), getRefreshExpiration()],
  );
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await persistRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
  };
}

async function login({ email, password }) {
  const user = await findUserByEmail(email);

  if (!user || user.estado !== 'activo') {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    throw error;
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    throw error;
  }

  await pool.query('UPDATE usuarios SET ultimo_acceso_en = NOW() WHERE id = $1', [user.id]);

  return {
    user: sanitizeUser(user),
    tokens: await issueTokens(user),
  };
}

async function revokeRefreshToken(refreshToken) {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revocado = TRUE,
          revocado_en = NOW()
      WHERE token_hash = $1
    `,
    [hashToken(refreshToken)],
  );
}

async function revokeUserRefreshTokens(userId) {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revocado = TRUE,
          revocado_en = NOW()
      WHERE usuario_id = $1
        AND revocado = FALSE
    `,
    [userId],
  );
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const result = await pool.query(
    `
      SELECT id, password_hash
      FROM usuarios
      WHERE id = $1
        AND estado = 'activo'
      LIMIT 1
    `,
    [userId],
  );

  const user = result.rows[0];
  if (!user) {
    const error = new Error('Usuario no autorizado');
    error.statusCode = 401;
    throw error;
  }

  const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!validPassword) {
    const error = new Error('Contrasena actual incorrecta');
    error.statusCode = 400;
    throw error;
  }

  const samePassword = await bcrypt.compare(newPassword, user.password_hash);
  if (samePassword) {
    const error = new Error('La nueva contrasena debe ser diferente');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    `
      UPDATE usuarios
      SET password_hash = $2,
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [userId, passwordHash],
  );
  await revokeUserRefreshTokens(userId);
}

async function refresh(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const storedToken = await pool.query(
    `
      SELECT id, usuario_id
      FROM refresh_tokens
      WHERE token_hash = $1
        AND revocado = FALSE
        AND expira_en > NOW()
      LIMIT 1
    `,
    [tokenHash],
  );

  if (!storedToken.rows.length || storedToken.rows[0].usuario_id !== payload.usuario_id) {
    const error = new Error('Refresh token invalido');
    error.statusCode = 401;
    throw error;
  }

  await revokeRefreshToken(refreshToken);

  const user = await findUserById(payload.usuario_id);

  if (!user || user.estado !== 'activo') {
    const error = new Error('Usuario no autorizado');
    error.statusCode = 401;
    throw error;
  }

  return {
    user: sanitizeUser(user),
    tokens: await issueTokens(user),
  };
}

module.exports = {
  login,
  refresh,
  revokeRefreshToken,
  changePassword,
  findUserById,
  sanitizeUser,
};
