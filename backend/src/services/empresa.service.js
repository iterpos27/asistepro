const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { deleteObject, getObject, putObject } = require('./storage.service');

const EMPRESA_ESTADOS = ['activa', 'suspendida', 'cancelada'];
const LOGO_TIPOS = ['image/png', 'image/jpeg'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function getBase64Payload(file) {
  const rawBase64 = String(file?.data_base64 || file?.data || '');
  return rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
}

function normalizeLogo(file) {
  if (!file) return null;

  return {
    nombre: String(file.nombre || file.name || '').trim().slice(0, 255),
    tipo: String(file.tipo || file.type || '').trim(),
    data: Buffer.from(getBase64Payload(file), 'base64'),
  };
}

function buildLogoStorageKey({ empresaId, fileName }) {
  return `tenants/${empresaId}/branding/${Date.now()}-${String(fileName || 'logo').replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
}

function normalizeEmpresaPayload(payload) {
  return {
    plan_id: payload.plan_id || null,
    nombre: payload.nombre?.trim(),
    identificacion_fiscal: payload.identificacion_fiscal?.trim() || null,
    email: payload.email?.trim().toLowerCase() || null,
    telefono: payload.telefono?.trim() || null,
    direccion: payload.direccion?.trim() || null,
    estado: payload.estado || 'activa',
    logo: payload.logo || undefined,
  };
}

function validateEmpresaPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.nombre !== undefined) {
    if (!payload.nombre?.trim()) {
      errors.push('nombre es requerido');
    }
  }

  if (payload.estado !== undefined && !EMPRESA_ESTADOS.includes(payload.estado)) {
    errors.push('estado invalido');
  }

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push('email invalido');
  }

  if (payload.logo) {
    const logo = normalizeLogo(payload.logo);
    const estimatedBytes = (getBase64Payload(payload.logo).length * 3) / 4;
    if (!logo.nombre) errors.push('logo.nombre es requerido');
    if (!LOGO_TIPOS.includes(logo.tipo)) errors.push('El logo debe ser PNG o JPG');
    if (!logo.data.length) errors.push('archivo de logo vacio');
    if (estimatedBytes > LOGO_MAX_BYTES || logo.data.length > LOGO_MAX_BYTES) {
      errors.push('El logo no puede superar 2MB');
    }
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

async function assertPlanExists(planId) {
  if (!planId) return;

  const result = await pool.query(
    'SELECT id FROM planes WHERE id = $1 AND activo = TRUE LIMIT 1',
    [planId],
  );

  if (!result.rows.length) {
    const error = new Error('plan_id no existe o esta inactivo');
    error.statusCode = 400;
    throw error;
  }
}

async function findRoleId(client, codigo) {
  const result = await client.query('SELECT id FROM roles WHERE codigo = $1 LIMIT 1', [codigo]);
  if (!result.rows.length) {
    const error = new Error(`Rol ${codigo} no existe`);
    error.statusCode = 400;
    throw error;
  }

  return result.rows[0].id;
}

async function listEmpresas({ search, estado, limit = 20, offset = 0 }) {
  const filters = [];
  const values = [];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      LOWER(e.nombre) LIKE $${values.length}
      OR LOWER(COALESCE(e.email, '')) LIKE $${values.length}
      OR LOWER(COALESCE(e.identificacion_fiscal, '')) LIKE $${values.length}
    )`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`e.estado = $${values.length}`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.plan_id,
        e.nombre,
        e.identificacion_fiscal,
        e.email,
        e.telefono,
        e.direccion,
        e.estado,
        e.logo_nombre,
        e.logo_tipo,
        e.logo_storage_url,
        e.logo_subido_en,
        (e.logo_data IS NOT NULL OR e.logo_storage_key IS NOT NULL) AS tiene_logo,
        e.creado_en,
        e.actualizado_en,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre,
        COUNT(*) OVER() AS total
      FROM empresas e
      LEFT JOIN planes p ON p.id = e.plan_id
      ${where}
      ORDER BY e.creado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...empresa }) => empresa),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function findEmpresaById(id) {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.plan_id,
        e.nombre,
        e.identificacion_fiscal,
        e.email,
        e.telefono,
        e.direccion,
        e.estado,
        e.logo_nombre,
        e.logo_tipo,
        e.logo_storage_provider,
        e.logo_storage_bucket,
        e.logo_storage_key,
        e.logo_storage_url,
        e.logo_subido_en,
        (e.logo_data IS NOT NULL OR e.logo_storage_key IS NOT NULL) AS tiene_logo,
        e.creado_en,
        e.actualizado_en,
        p.codigo AS plan_codigo,
        p.nombre AS plan_nombre
      FROM empresas e
      LEFT JOIN planes p ON p.id = e.plan_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function createEmpresa(payload) {
  validateEmpresaPayload(payload);
  const empresa = normalizeEmpresaPayload(payload);

  await assertPlanExists(empresa.plan_id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO empresas (
          plan_id,
          nombre,
          identificacion_fiscal,
          email,
          telefono,
          direccion,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        empresa.plan_id,
        empresa.nombre,
        empresa.identificacion_fiscal,
        empresa.email,
        empresa.telefono,
        empresa.direccion,
        empresa.estado,
      ],
    );

    const empresaId = result.rows[0].id;

    if (payload.admin_email && payload.admin_password) {
      const rolId = await findRoleId(client, 'ADMIN_EMPRESA');
      const passwordHash = await bcrypt.hash(payload.admin_password, 10);
      const adminNombre = payload.admin_nombre?.trim() || 'Administrador';
      const adminApellido = payload.admin_apellido?.trim() || empresa.nombre;

      await client.query(
        `
          INSERT INTO usuarios (
            empresa_id,
            rol_id,
            nombre,
            apellido,
            email,
            password_hash,
            telefono,
            estado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
        `,
        [
          empresaId,
          rolId,
          adminNombre,
          adminApellido,
          payload.admin_email.trim().toLowerCase(),
          passwordHash,
          payload.admin_telefono?.trim() || empresa.telefono,
        ],
      );
    }

    await client.query('COMMIT');
    return findEmpresaById(empresaId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateEmpresa(id, payload) {
  validateEmpresaPayload(payload, { partial: true });

  const current = await findEmpresaById(id);

  if (!current) {
    return null;
  }

  const next = {
    plan_id: payload.plan_id !== undefined ? payload.plan_id || null : current.plan_id,
    nombre: payload.nombre !== undefined ? payload.nombre?.trim() : current.nombre,
    identificacion_fiscal:
      payload.identificacion_fiscal !== undefined
        ? payload.identificacion_fiscal?.trim() || null
        : current.identificacion_fiscal,
    email: payload.email !== undefined ? payload.email?.trim().toLowerCase() || null : current.email,
    telefono: payload.telefono !== undefined ? payload.telefono?.trim() || null : current.telefono,
    direccion: payload.direccion !== undefined ? payload.direccion?.trim() || null : current.direccion,
    estado: payload.estado !== undefined ? payload.estado : current.estado,
    logo: payload.logo !== undefined ? payload.logo : undefined,
  };

  await assertPlanExists(next.plan_id);

  const logo = payload.logo !== undefined ? normalizeLogo(payload.logo) : undefined;
  let logoMeta = {
    provider: current.logo_storage_provider || null,
    bucket: current.logo_storage_bucket || null,
    key: current.logo_storage_key || null,
    url: current.logo_storage_url || null,
  };

  if (payload.logo !== undefined) {
    if (logo?.data?.length) {
      logoMeta = await putObject({
        key: buildLogoStorageKey({ empresaId: id, fileName: logo.nombre }),
        body: logo.data,
        contentType: logo.tipo,
      });
    } else {
      logoMeta = { provider: null, bucket: null, key: null, url: null };
    }
  }

  const usesExternalStorage = logoMeta?.provider && logoMeta.provider !== 'database';

  await pool.query(
    `
      UPDATE empresas
      SET plan_id = $2,
          nombre = $3,
          identificacion_fiscal = $4,
          email = $5,
          telefono = $6,
          direccion = $7,
          estado = $8,
          logo_nombre = CASE WHEN $9::boolean THEN $10::varchar ELSE logo_nombre END,
          logo_tipo = CASE WHEN $9::boolean THEN $11::varchar ELSE logo_tipo END,
          logo_data = CASE WHEN $9::boolean THEN $12::bytea ELSE logo_data END,
          logo_storage_provider = CASE WHEN $9::boolean THEN $13::varchar ELSE logo_storage_provider END,
          logo_storage_bucket = CASE WHEN $9::boolean THEN $14::varchar ELSE logo_storage_bucket END,
          logo_storage_key = CASE WHEN $9::boolean THEN $15::text ELSE logo_storage_key END,
          logo_storage_url = CASE WHEN $9::boolean THEN $16::text ELSE logo_storage_url END,
          logo_subido_en = CASE WHEN $9::boolean THEN (CASE WHEN $12::bytea IS NULL AND $15::text IS NULL THEN NULL ELSE NOW() END) ELSE logo_subido_en END,
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [
      id,
      next.plan_id,
      next.nombre,
      next.identificacion_fiscal,
      next.email,
      next.telefono,
      next.direccion,
      next.estado,
      payload.logo !== undefined,
      logo?.nombre || null,
      logo?.tipo || null,
      usesExternalStorage ? null : logo?.data || null,
      usesExternalStorage ? logoMeta?.provider || null : null,
      usesExternalStorage ? logoMeta?.bucket || null : null,
      usesExternalStorage ? logoMeta?.key || null : null,
      usesExternalStorage ? logoMeta?.url || null : null,
    ],
  );

  if (payload.logo !== undefined && current.logo_storage_key && current.logo_storage_key !== logoMeta?.key) {
    await deleteObject({ bucket: current.logo_storage_bucket, key: current.logo_storage_key });
  }

  return findEmpresaById(id);
}

async function deleteEmpresa(id) {
  const empresa = await findEmpresaById(id);

  if (!empresa) {
    return null;
  }

  await pool.query(
    `
      UPDATE empresas
      SET estado = 'cancelada',
          actualizado_en = NOW()
      WHERE id = $1
    `,
    [id],
  );

  return findEmpresaById(id);
}

async function resetAdminPassword(id) {
  const empresa = await findEmpresaById(id);
  if (!empresa) {
    const error = new Error('Empresa no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const userResult = await pool.query(
    `
      SELECT u.id, u.email, u.nombre, u.apellido
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.empresa_id = $1 AND r.codigo = 'ADMIN_EMPRESA'
      LIMIT 1
    `,
    [id],
  );

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = userResult.rows[0];

  if (!user) {
    // Si no existe un administrador asignado, lo creamos dinamicamente usando los datos de la empresa
    const rolResult = await pool.query("SELECT id FROM roles WHERE codigo = 'ADMIN_EMPRESA' LIMIT 1");
    if (!rolResult.rows.length) {
      const error = new Error('No se encontro el rol ADMIN_EMPRESA');
      error.statusCode = 500;
      throw error;
    }
    const rolId = rolResult.rows[0].id;
    const adminEmail = empresa.email || `admin@${empresa.nombre.toLowerCase().replace(/[^a-z0-9]/g, '')}.local`;

    await pool.query(
      `
        INSERT INTO usuarios (
          empresa_id,
          rol_id,
          nombre,
          apellido,
          email,
          password_hash,
          estado
        ) VALUES ($1, $2, 'Administrador', $3, $4, $5, 'activo')
      `,
      [id, rolId, empresa.nombre, adminEmail.toLowerCase().trim(), passwordHash],
    );

    return {
      email: adminEmail,
      nombre: 'Administrador',
      apellido: empresa.nombre,
      tempPassword: password,
      created: true,
    };
  }

  await pool.query(
    `
      UPDATE usuarios
      SET password_hash = $1, actualizado_en = NOW()
      WHERE id = $2
    `,
    [passwordHash, user.id],
  );

  return {
    email: user.email,
    nombre: user.nombre,
    apellido: user.apellido,
    tempPassword: password,
  };
}

async function readEmpresaLogo(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        nombre,
        logo_nombre,
        logo_tipo,
        logo_data,
        logo_storage_bucket,
        logo_storage_key,
        logo_storage_url
      FROM empresas
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  const empresa = result.rows[0];
  if (!empresa) return null;

  if (!empresa.logo_data && !empresa.logo_storage_key) {
    return {
      ...empresa,
      logo_data: null,
    };
  }

  return {
    ...empresa,
    logo_data: await getObject({
      bucket: empresa.logo_storage_bucket,
      key: empresa.logo_storage_key,
      fallbackBody: empresa.logo_data,
    }),
  };
}

module.exports = {
  listEmpresas,
  findEmpresaById,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
  resetAdminPassword,
  readEmpresaLogo,
};
