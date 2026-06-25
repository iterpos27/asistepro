const bcrypt = require('bcryptjs');

const { pool } = require('../config/database');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshExpiration,
} = require('../config/jwt');
const { hashToken } = require('../utils/token.util');
const { buildEffectiveModules } = require('../utils/module-permissions.util');
const { mergePermissions } = require('../utils/granular-permissions.util');

function sanitizeUser(user) {
  const modulos = buildEffectiveModules({
    empresaModules: user.configuracion_modulos,
    userModules: user.usuario_configuracion_modulos,
    role: user.rol_codigo,
  });
  const permisos = mergePermissions(
    user.rol_codigo,
    user.rol_personalizado_permisos,
    user.usuario_configuracion_permisos,
  );

  return {
    id: user.id,
    empresa_id: user.empresa_id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    estado: user.estado,
    rol: user.rol_codigo,
    empresa: user.empresa_nombre,
    modulos,
    permisos,
    rol_personalizado: user.rol_personalizado_nombre || null,
    cedula: user.cedula || null,
    username: user.username || null,
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
        u.cedula,
        u.username,
        u.configuracion_modulos AS usuario_configuracion_modulos,
        u.configuracion_permisos AS usuario_configuracion_permisos,
        r.codigo AS rol_codigo,
        e.nombre AS empresa_nombre,
        e.configuracion_modulos,
        rp.nombre AS rol_personalizado_nombre,
        rp.permisos AS rol_personalizado_permisos
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      LEFT JOIN empresas e ON e.id = u.empresa_id
      LEFT JOIN roles_personalizados rp ON rp.id = u.rol_personalizado_id AND rp.activo = TRUE
      WHERE LOWER(u.email) = LOWER($1) OR LOWER(u.username) = LOWER($1)
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
        u.cedula,
        u.username,
        u.configuracion_modulos AS usuario_configuracion_modulos,
        u.configuracion_permisos AS usuario_configuracion_permisos,
        r.codigo AS rol_codigo,
        e.nombre AS empresa_nombre,
        e.configuracion_modulos,
        rp.nombre AS rol_personalizado_nombre,
        rp.permisos AS rol_personalizado_permisos
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      LEFT JOIN empresas e ON e.id = u.empresa_id
      LEFT JOIN roles_personalizados rp ON rp.id = u.rol_personalizado_id AND rp.activo = TRUE
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

async function registerTenant(payload) {
  // 1. Check if email is already in use
  const existingUser = await pool.query(
    'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [payload.admin_email.trim().toLowerCase()]
  );
  if (existingUser.rows.length) {
    const error = new Error('El email de administrador ya se encuentra registrado');
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch the plan
  const planResult = await pool.query(
    'SELECT * FROM planes WHERE id = $1 AND activo = TRUE LIMIT 1',
    [payload.plan_id]
  );
  if (!planResult.rows.length) {
    const error = new Error('El plan seleccionado no existe o no esta activo');
    error.statusCode = 400;
    throw error;
  }
  const plan = planResult.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3. Insert Empresa
    const empresaRes = await client.query(
      `
        INSERT INTO empresas (
          plan_id,
          nombre,
          identificacion_fiscal,
          email,
          telefono,
          direccion,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, 'activa')
        RETURNING *
      `,
      [
        plan.id,
        payload.nombre.trim(),
        payload.identificacion_fiscal.trim(),
        payload.email.trim().toLowerCase(),
        payload.telefono?.trim() || null,
        payload.direccion?.trim() || null,
      ]
    );
    const empresa = empresaRes.rows[0];

    // 4. Retrieve ADMIN_EMPRESA role ID
    const rolRes = await client.query("SELECT id FROM roles WHERE codigo = 'ADMIN_EMPRESA' LIMIT 1");
    if (!rolRes.rows.length) {
      const error = new Error('No se encontro el rol ADMIN_EMPRESA en el sistema');
      error.statusCode = 500;
      throw error;
    }
    const rolId = rolRes.rows[0].id;

    // 5. Hash password and insert Admin User
    const passwordHash = await bcrypt.hash(payload.admin_password, 10);
    const userRes = await client.query(
      `
        INSERT INTO usuarios (
          empresa_id,
          rol_id,
          nombre,
          apellido,
          email,
          password_hash,
          telefono,
          cedula,
          username,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo')
        RETURNING *
      `,
      [
        empresa.id,
        rolId,
        payload.admin_nombre.trim(),
        payload.admin_apellido.trim(),
        payload.admin_email.trim().toLowerCase(),
        passwordHash,
        payload.admin_telefono?.trim() || payload.telefono || null,
        payload.admin_cedula?.trim() || null,
        payload.admin_username?.trim().toLowerCase() || null,
      ]
    );
    const user = userRes.rows[0];

    // 6. Create Suscripcion (active, start date today, end date today + 30 days)
    const todayStr = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const offset = end.getTimezoneOffset();
    const localEnd = new Date(end.getTime() - offset * 60 * 1000);
    const endStr = localEnd.toISOString().slice(0, 10);

    const subRes = await client.query(
      `
        INSERT INTO suscripciones (
          empresa_id,
          plan_id,
          estado,
          fecha_inicio,
          fecha_fin,
          monto_mensual
        ) VALUES ($1, $2, 'activa', $3, $4, $5)
        RETURNING *
      `,
      [
        empresa.id,
        plan.id,
        todayStr,
        endStr,
        plan.precio_mensual,
      ]
    );
    const subscription = subRes.rows[0];

    // 7. Create Invoice (pendiente, total = plan amount, number = FAC-REG-...)
    const invoiceNum = 'FAC-REG-' + Date.now();
    const invoiceRes = await client.query(
      `
        INSERT INTO facturas (
          empresa_id,
          suscripcion_id,
          numero,
          concepto,
          subtotal,
          impuesto,
          total,
          estado,
          fecha_emision,
          fecha_vencimiento
        ) VALUES ($1, $2, $3, $4, $5, 0, $5, 'pendiente', $6, $7)
        RETURNING *
      `,
      [
        empresa.id,
        subscription.id,
        invoiceNum,
        `Suscripcion mensual - Plan ${plan.nombre}`,
        plan.precio_mensual,
        todayStr,
        endStr,
      ]
    );
    const invoice = invoiceRes.rows[0];

    await client.query('COMMIT');

    const fullUser = await findUserById(user.id);
    return {
      user: sanitizeUser(fullUser),
      tokens: await issueTokens(fullUser),
      factura_id: invoice.id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  login,
  refresh,
  revokeRefreshToken,
  changePassword,
  findUserById,
  sanitizeUser,
  registerTenant,
};
