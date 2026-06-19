const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');

const { pool } = require('../config/database');
const { putObject, getStorageStatus } = require('./storage.service');

const STRUCTURE_TYPES = ['direccion', 'departamento', 'area', 'cargo', 'centro_costo', 'unidad'];
const IMPORT_ROLE_CODES = ['EMPLEADO', 'RRHH'];

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), typeof value === 'string' ? value.trim() : value]),
  );
}

function asNullableString(value, maxLength = 255) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function asNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'si', 'sí', 'true', 'yes', 'y', 'x'].includes(normalized);
}

function generateTempPassword() {
  return `Asp-${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-4)}`;
}

function normalizeStructurePayload(payload) {
  if (!payload.tipo || !STRUCTURE_TYPES.includes(payload.tipo)) {
    const error = new Error('tipo de estructura invalido');
    error.statusCode = 400;
    throw error;
  }
  if (!payload.codigo?.trim() || !payload.nombre?.trim()) {
    const error = new Error('codigo y nombre son requeridos');
    error.statusCode = 400;
    throw error;
  }

  return {
    tipo: payload.tipo,
    parent_id: payload.parent_id || null,
    codigo: payload.codigo.trim().toUpperCase(),
    nombre: payload.nombre.trim(),
    descripcion: asNullableString(payload.descripcion, 500),
    responsable_empleado_id: payload.responsable_empleado_id || null,
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
  };
}

async function assertStructureParent(empresaId, parentId) {
  if (!parentId) return;
  const result = await pool.query(
    `SELECT id FROM estructuras_organizacionales WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, parentId],
  );
  if (!result.rows.length) {
    const error = new Error('parent_id no pertenece a la empresa');
    error.statusCode = 400;
    throw error;
  }
}

async function assertResponsable(empresaId, empleadoId) {
  if (!empleadoId) return;
  const result = await pool.query(`SELECT id FROM empleados WHERE empresa_id = $1 AND id = $2 LIMIT 1`, [empresaId, empleadoId]);
  if (!result.rows.length) {
    const error = new Error('responsable_empleado_id no pertenece a la empresa');
    error.statusCode = 400;
    throw error;
  }
}

async function listStructures({ empresaId, tipo, activo = true }) {
  const values = [empresaId];
  const filters = ['e.empresa_id = $1'];

  if (tipo) {
    values.push(tipo);
    filters.push(`e.tipo = $${values.length}`);
  }

  if (activo !== undefined) {
    values.push(Boolean(activo));
    filters.push(`e.activo = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        e.*,
        parent.nombre AS parent_nombre,
        responsable.codigo AS responsable_codigo,
        responsable.nombres AS responsable_nombres,
        responsable.apellidos AS responsable_apellidos
      FROM estructuras_organizacionales e
      LEFT JOIN estructuras_organizacionales parent ON parent.id = e.parent_id
      LEFT JOIN empleados responsable ON responsable.id = e.responsable_empleado_id
      WHERE ${filters.join(' AND ')}
      ORDER BY
        CASE e.tipo
          WHEN 'direccion' THEN 1
          WHEN 'departamento' THEN 2
          WHEN 'area' THEN 3
          WHEN 'unidad' THEN 4
          WHEN 'cargo' THEN 5
          WHEN 'centro_costo' THEN 6
          ELSE 99
        END,
        e.nombre ASC
    `,
    values,
  );

  return result.rows;
}

async function getSummary(empresaId) {
  const [structuresResult, importsResult, employeesResult] = await Promise.all([
    pool.query(
      `SELECT tipo, COUNT(*)::int AS total FROM estructuras_organizacionales WHERE empresa_id = $1 AND activo = TRUE GROUP BY tipo`,
      [empresaId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(filas_con_error), 0)::int AS errores
       FROM importaciones_empleados
       WHERE empresa_id = $1 AND creado_en >= date_trunc('month', NOW())`,
      [empresaId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE usuario_id IS NOT NULL)::int AS con_usuario
       FROM empleados WHERE empresa_id = $1 AND estado = 'activo'`,
      [empresaId],
    ),
  ]);

  return {
    estructuras: Object.fromEntries(structuresResult.rows.map((row) => [row.tipo, Number(row.total)])),
    importaciones_mes: Number(importsResult.rows[0]?.total || 0),
    errores_mes: Number(importsResult.rows[0]?.errores || 0),
    empleados_activos: Number(employeesResult.rows[0]?.total || 0),
    empleados_con_usuario: Number(employeesResult.rows[0]?.con_usuario || 0),
    storage: getStorageStatus(),
  };
}

async function getCatalogs(empresaId) {
  const [structures, sucursales, supervisores] = await Promise.all([
    listStructures({ empresaId, activo: true }),
    pool.query(`SELECT id, codigo, nombre FROM sucursales WHERE empresa_id = $1 AND estado = 'activa' ORDER BY nombre`, [empresaId]),
    pool.query(`SELECT id, codigo, nombres, apellidos FROM empleados WHERE empresa_id = $1 AND estado = 'activo' ORDER BY apellidos, nombres`, [empresaId]),
  ]);

  return {
    estructuras: structures,
    sucursales: sucursales.rows,
    supervisores: supervisores.rows,
  };
}

async function saveStructure(empresaId, payload, id = null) {
  const item = normalizeStructurePayload(payload);
  await assertStructureParent(empresaId, item.parent_id);
  await assertResponsable(empresaId, item.responsable_empleado_id);

  if (id) {
    const result = await pool.query(
      `
        UPDATE estructuras_organizacionales
        SET parent_id = $3,
            tipo = $4,
            codigo = $5,
            nombre = $6,
            descripcion = $7,
            responsable_empleado_id = $8,
            metadata = $9::jsonb,
            activo = $10,
            actualizado_en = NOW()
        WHERE empresa_id = $1
          AND id = $2
        RETURNING *
      `,
      [
        empresaId,
        id,
        item.parent_id,
        item.tipo,
        item.codigo,
        item.nombre,
        item.descripcion,
        item.responsable_empleado_id,
        JSON.stringify(item.metadata),
        item.activo,
      ],
    );
    return result.rows[0] || null;
  }

  const result = await pool.query(
    `
      INSERT INTO estructuras_organizacionales (
        empresa_id, parent_id, tipo, codigo, nombre, descripcion, responsable_empleado_id, metadata, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      RETURNING *
    `,
    [
      empresaId,
      item.parent_id,
      item.tipo,
      item.codigo,
      item.nombre,
      item.descripcion,
      item.responsable_empleado_id,
      JSON.stringify(item.metadata),
      item.activo,
    ],
  );
  return result.rows[0];
}

async function deactivateStructure(empresaId, id) {
  const result = await pool.query(
    `UPDATE estructuras_organizacionales SET activo = FALSE, actualizado_en = NOW() WHERE empresa_id = $1 AND id = $2 RETURNING *`,
    [empresaId, id],
  );
  return result.rows[0] || null;
}

async function parseWorkbookRows(fileBase64) {
  const buffer = Buffer.from(String(fileBase64 || '').split(',').pop(), 'base64');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    const error = new Error('El archivo Excel no contiene hojas');
    error.statusCode = 400;
    throw error;
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values
    .slice(1)
    .map((header) => normalizeHeader(typeof header === 'object' ? header?.text : header));

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    if (!values.some((value) => value !== null && value !== undefined && String(value).trim() !== '')) return;
    const item = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = values[index];
      item[header] = typeof value === 'object' && value?.text !== undefined ? value.text : value;
    });
    rows.push(normalizeRow(item));
  });

  return rows;
}

async function findRoleId(client, roleCode) {
  const result = await client.query(`SELECT id FROM roles WHERE codigo = $1 LIMIT 1`, [roleCode]);
  if (!result.rows.length) {
    const error = new Error(`Rol ${roleCode} no encontrado`);
    error.statusCode = 400;
    throw error;
  }
  return result.rows[0].id;
}

async function resolveSucursal(client, empresaId, row) {
  const codigo = asNullableString(row.sucursal_codigo, 50);
  const nombre = asNullableString(row.sucursal_nombre, 160);
  if (!codigo && !nombre) return null;
  const result = await client.query(
    `
      SELECT id
      FROM sucursales
      WHERE empresa_id = $1
        AND (
          ($2::text IS NOT NULL AND UPPER(codigo) = UPPER($2))
          OR ($3::text IS NOT NULL AND LOWER(nombre) = LOWER($3))
        )
      LIMIT 1
    `,
    [empresaId, codigo, nombre],
  );
  if (!result.rows.length) {
    const error = new Error(`Sucursal no encontrada: ${codigo || nombre}`);
    error.statusCode = 400;
    throw error;
  }
  return result.rows[0].id;
}

async function resolveSupervisor(client, empresaId, row) {
  const codigo = asNullableString(row.supervisor_codigo, 50);
  if (!codigo) return null;
  const result = await client.query(
    `SELECT id FROM empleados WHERE empresa_id = $1 AND UPPER(codigo) = UPPER($2) LIMIT 1`,
    [empresaId, codigo],
  );
  if (!result.rows.length) {
    const error = new Error(`Supervisor no encontrado: ${codigo}`);
    error.statusCode = 400;
    throw error;
  }
  return result.rows[0].id;
}

async function resolveOrCreateStructure(client, empresaId, tipo, row, fallbackParentId = null) {
  const codigo = asNullableString(row[`${tipo}_codigo`] || row[`${tipo}_id`], 50);
  const nombre = asNullableString(row[`${tipo}_nombre`] || row[tipo], 160);
  if (!codigo && !nombre) return null;

  const effectiveCode = (codigo || nombre).toUpperCase().replace(/\s+/g, '_').slice(0, 50);
  const existing = await client.query(
    `SELECT id FROM estructuras_organizacionales WHERE empresa_id = $1 AND tipo = $2 AND codigo = $3 LIMIT 1`,
    [empresaId, tipo, effectiveCode],
  );
  if (existing.rows.length) return existing.rows[0].id;

  const created = await client.query(
    `
      INSERT INTO estructuras_organizacionales (empresa_id, parent_id, tipo, codigo, nombre)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [empresaId, fallbackParentId, tipo, effectiveCode, nombre || effectiveCode],
  );
  return created.rows[0].id;
}

async function upsertUserForEmployee(client, empresaId, row, empleadoActual) {
  const crearUsuario = asBoolean(row.crear_usuario) || Boolean(asNullableString(row.email, 160));
  if (!crearUsuario) return { usuarioId: empleadoActual?.usuario_id || null, passwordGenerada: null };

  const email = asNullableString(row.email, 160)?.toLowerCase();
  if (!email) {
    const error = new Error('email es requerido para crear usuario');
    error.statusCode = 400;
    throw error;
  }

  const roleCode = IMPORT_ROLE_CODES.includes(String(row.rol_acceso || '').trim().toUpperCase())
    ? String(row.rol_acceso).trim().toUpperCase()
    : 'EMPLEADO';
  const roleId = await findRoleId(client, roleCode);
  const existingUser = await client.query(
    `SELECT id, password_hash FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );

  const passwordGenerada = asNullableString(row.password_acceso, 120) || generateTempPassword();
  const passwordHash = await bcrypt.hash(passwordGenerada, 10);

  if (existingUser.rows.length) {
    await client.query(
      `
        UPDATE usuarios
        SET empresa_id = $2,
            rol_id = $3,
            nombre = $4,
            apellido = $5,
            telefono = $6,
            estado = 'activo',
            actualizado_en = NOW()
        WHERE id = $1
      `,
      [
        existingUser.rows[0].id,
        empresaId,
        roleId,
        asNullableString(row.nombres, 120),
        asNullableString(row.apellidos, 120),
        asNullableString(row.telefono, 40),
      ],
    );
    return { usuarioId: existingUser.rows[0].id, passwordGenerada: row.password_acceso ? null : passwordGenerada };
  }

  const inserted = await client.query(
    `
      INSERT INTO usuarios (empresa_id, rol_id, nombre, apellido, email, password_hash, telefono, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
      RETURNING id
    `,
    [
      empresaId,
      roleId,
      asNullableString(row.nombres, 120),
      asNullableString(row.apellidos, 120),
      email,
      passwordHash,
      asNullableString(row.telefono, 40),
    ],
  );
  return { usuarioId: inserted.rows[0].id, passwordGenerada: row.password_acceso ? null : passwordGenerada };
}

async function upsertEmployeeRow(client, empresaId, row) {
  const codigo = asNullableString(row.codigo, 50)?.toUpperCase();
  const nombres = asNullableString(row.nombres, 120);
  const apellidos = asNullableString(row.apellidos, 120);
  if (!codigo || !nombres || !apellidos) {
    const error = new Error('codigo, nombres y apellidos son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const existing = await client.query(
    `SELECT * FROM empleados WHERE empresa_id = $1 AND UPPER(codigo) = UPPER($2) LIMIT 1`,
    [empresaId, codigo],
  );
  const current = existing.rows[0] || null;

  const departamentoId = await resolveOrCreateStructure(client, empresaId, 'departamento', row);
  const areaId = await resolveOrCreateStructure(client, empresaId, 'area', row, departamentoId);
  const cargoId = await resolveOrCreateStructure(client, empresaId, 'cargo', row);
  const centroCostoId = await resolveOrCreateStructure(client, empresaId, 'centro_costo', row);
  const sucursalId = await resolveSucursal(client, empresaId, row);
  const supervisorId = await resolveSupervisor(client, empresaId, row);
  const { usuarioId, passwordGenerada } = await upsertUserForEmployee(client, empresaId, row, current);

  const payload = {
    usuario_id: usuarioId,
    sucursal_habitual_id: sucursalId,
    codigo,
    nombres,
    apellidos,
    email: asNullableString(row.email, 160)?.toLowerCase(),
    telefono: asNullableString(row.telefono, 40),
    cargo: asNullableString(row.cargo_legado || row.cargo_nombre || row.cargo, 120),
    departamento: asNullableString(row.departamento_legado || row.departamento_nombre || row.departamento, 120),
    area_estructura_id: areaId,
    cargo_estructura_id: cargoId,
    centro_costo_estructura_id: centroCostoId,
    supervisor_empleado_id: supervisorId,
    tipo_contrato: asNullableString(row.tipo_contrato, 50),
    salario_base: asNullableNumber(row.salario_base),
    fecha_ingreso: asNullableString(row.fecha_ingreso, 20),
    estado: ['activo', 'inactivo', 'suspendido'].includes(String(row.estado || '').trim().toLowerCase())
      ? String(row.estado).trim().toLowerCase()
      : 'activo',
  };

  if (current) {
    await client.query(
      `
        UPDATE empleados
        SET usuario_id = $3,
            sucursal_habitual_id = $4,
            nombres = $5,
            apellidos = $6,
            email = $7,
            telefono = $8,
            cargo = $9,
            departamento = $10,
            area_estructura_id = $11,
            cargo_estructura_id = $12,
            centro_costo_estructura_id = $13,
            supervisor_empleado_id = $14,
            tipo_contrato = $15,
            salario_base = $16,
            fecha_ingreso = $17,
            estado = $18,
            actualizado_en = NOW()
        WHERE empresa_id = $1
          AND id = $2
      `,
      [
        empresaId,
        current.id,
        payload.usuario_id,
        payload.sucursal_habitual_id,
        payload.nombres,
        payload.apellidos,
        payload.email,
        payload.telefono,
        payload.cargo,
        payload.departamento,
        payload.area_estructura_id,
        payload.cargo_estructura_id,
        payload.centro_costo_estructura_id,
        payload.supervisor_empleado_id,
        payload.tipo_contrato,
        payload.salario_base,
        payload.fecha_ingreso,
        payload.estado,
      ],
    );
    return { action: 'updated', passwordGenerada };
  }

  await client.query(
    `
      INSERT INTO empleados (
        empresa_id, usuario_id, sucursal_habitual_id, codigo, nombres, apellidos, email, telefono, cargo,
        departamento, area_estructura_id, cargo_estructura_id, centro_costo_estructura_id, supervisor_empleado_id,
        tipo_contrato, salario_base, fecha_ingreso, estado
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
    `,
    [
      empresaId,
      payload.usuario_id,
      payload.sucursal_habitual_id,
      payload.codigo,
      payload.nombres,
      payload.apellidos,
      payload.email,
      payload.telefono,
      payload.cargo,
      payload.departamento,
      payload.area_estructura_id,
      payload.cargo_estructura_id,
      payload.centro_costo_estructura_id,
      payload.supervisor_empleado_id,
      payload.tipo_contrato,
      payload.salario_base,
      payload.fecha_ingreso,
      payload.estado,
    ],
  );
  return { action: 'created', passwordGenerada };
}

async function listImports(empresaId) {
  const result = await pool.query(
    `SELECT * FROM importaciones_empleados WHERE empresa_id = $1 ORDER BY creado_en DESC LIMIT 30`,
    [empresaId],
  );
  return result.rows;
}

async function importEmployeesFromExcel({ empresaId, usuarioId, fileBase64, filename }) {
  const rows = await parseWorkbookRows(fileBase64);
  if (!rows.length) {
    const error = new Error('El archivo Excel no contiene filas para importar');
    error.statusCode = 400;
    throw error;
  }

  const upload = await putObject({
    key: `tenants/${empresaId}/imports/${Date.now()}-${String(filename || 'empleados.xlsx').replace(/\s+/g, '_')}`,
    body: Buffer.from(String(fileBase64 || '').split(',').pop(), 'base64'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const client = await pool.connect();
  const errors = [];
  const generatedPasswords = [];
  let created = 0;
  let updated = 0;

  try {
    await client.query('BEGIN');

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      await client.query(`SAVEPOINT import_row`);
      try {
        const result = await upsertEmployeeRow(client, empresaId, row);
        if (result.action === 'created') created += 1;
        if (result.action === 'updated') updated += 1;
        if (result.passwordGenerada && row.email) {
          generatedPasswords.push({ codigo: row.codigo, email: row.email, password_temporal: result.passwordGenerada });
        }
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT import_row`);
        errors.push({ fila: index + 2, codigo: row.codigo || null, motivo: error.message });
      }
    }

    const estado = errors.length
      ? created || updated ? 'procesada_con_errores' : 'fallida'
      : 'procesada';
    const resumen = {
      filas_totales: rows.length,
      filas_creadas: created,
      filas_actualizadas: updated,
      filas_con_error: errors.length,
      passwords_temporales: generatedPasswords,
    };

    const inserted = await client.query(
      `
        INSERT INTO importaciones_empleados (
          empresa_id, usuario_id, nombre_archivo, estado, filas_totales, filas_creadas, filas_actualizadas, filas_con_error,
          resumen, errores, storage_provider, storage_bucket, storage_key, storage_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9::jsonb, $10::jsonb, $11, $12, $13, $14
        )
        RETURNING *
      `,
      [
        empresaId,
        usuarioId,
        filename || 'empleados.xlsx',
        estado,
        rows.length,
        created,
        updated,
        errors.length,
        JSON.stringify(resumen),
        JSON.stringify(errors),
        upload.provider,
        upload.bucket,
        upload.key,
        upload.url,
      ],
    );

    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  STRUCTURE_TYPES,
  deactivateStructure,
  getCatalogs,
  getSummary,
  importEmployeesFromExcel,
  listImports,
  listStructures,
  saveStructure,
};
