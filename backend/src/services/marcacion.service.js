const { pool } = require('../config/database');
const reemplazoService = require('./reemplazo.service');
const { calculateDistanceMeters } = require('../utils/geo.util');

const MARCACION_TIPOS = ['entrada', 'salida'];
const GPS_TOLERANCIA_METROS = Number(process.env.GPS_TOLERANCIA_METROS || 10);
const GPS_PRECISION_MAXIMA_METROS = Number(process.env.GPS_PRECISION_MAXIMA_METROS || 20);
const REPORT_TIME_ZONE = 'America/Guayaquil';
const MOTIVOS_NOVEDAD = [
  'Reemplazo',
  'Apoyo temporal',
  'Emergencia',
  'Autorizacion supervisor',
  'Otro',
];

function validateMarcacionPayload(payload) {
  const errors = [];

  if (!payload.qr_token) errors.push('qr_token es requerido');
  if (!MARCACION_TIPOS.includes(payload.tipo)) errors.push('tipo debe ser entrada o salida');

  const latitud = Number(payload.latitud);
  const longitud = Number(payload.longitud);

  if (Number.isNaN(latitud) || latitud < -90 || latitud > 90) errors.push('latitud invalida');
  if (Number.isNaN(longitud) || longitud < -180 || longitud > 180) errors.push('longitud invalida');

  if (payload.motivo_novedad && !MOTIVOS_NOVEDAD.includes(payload.motivo_novedad)) {
    errors.push('motivo_novedad invalido');
  }

  if (errors.length) {
    const error = new Error(errors.join(', '));
    error.statusCode = 400;
    throw error;
  }
}

async function findSucursalByQr(empresaId, qrToken) {
  const result = await pool.query(
    `
      SELECT *
      FROM sucursales
      WHERE empresa_id = $1
        AND qr_token = $2
      LIMIT 1
    `,
    [empresaId, qrToken],
  );

  return result.rows[0] || null;
}

async function findSucursalByDynamicQr(empresaId, qrToken) {
  const result = await pool.query(
    `
      UPDATE sucursal_tokens_dinamicos std
      SET usado_en = COALESCE(std.usado_en, NOW())
      FROM sucursales s
      WHERE s.empresa_id = $1
        AND s.id = std.sucursal_id
        AND s.estado = 'activa'
        AND std.token = $2
        AND std.expira_en > NOW()
      RETURNING s.*
    `,
    [empresaId, qrToken],
  );

  return result.rows[0] || null;
}

async function resolveSucursalByQr(empresaId, qrToken) {
  const dynamicSucursal = await findSucursalByDynamicQr(empresaId, qrToken);
  if (dynamicSucursal) return dynamicSucursal;

  return findSucursalByQr(empresaId, qrToken);
}

async function findEmpleadoForMarcacion({ empresaId, empleadoId, usuarioId, rol }) {
  const values = [empresaId];
  let condition = '';

  if (rol === 'EMPLEADO') {
    values.push(usuarioId);
    condition = `AND usuario_id = $${values.length}`;
  } else {
    if (!empleadoId) {
      const error = new Error('empleado_id es requerido');
      error.statusCode = 400;
      throw error;
    }

    values.push(empleadoId);
    condition = `AND id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT *
      FROM empleados
      WHERE empresa_id = $1
        ${condition}
        AND estado = 'activo'
      LIMIT 1
    `,
    values,
  );

  return result.rows[0] || null;
}

async function findActiveHorario({ empresaId, empleadoId, markedAt = new Date() }) {
  const result = await pool.query(
    `
      SELECT h.*
      FROM empleado_horarios eh
      INNER JOIN horarios h ON h.id = eh.horario_id
      WHERE eh.empresa_id = $1
        AND eh.empleado_id = $2
        AND eh.activo = TRUE
        AND h.activo = TRUE
        AND eh.fecha_inicio <= $3::date
        AND (eh.fecha_fin IS NULL OR eh.fecha_fin >= $3::date)
      ORDER BY eh.fecha_inicio DESC, eh.creado_en DESC
      LIMIT 1
    `,
    [empresaId, empleadoId, markedAt],
  );

  return result.rows[0] || null;
}

async function insertMarcacion(data) {
  const result = await pool.query(
    `
      INSERT INTO marcaciones (
        empresa_id,
        empleado_id,
        sucursal_id,
        horario_id,
        tipo,
        estado,
        latitud,
        longitud,
        distancia_metros,
        dentro_geocerca,
        motivo_novedad,
        detalle_novedad,
        mensaje,
        marcado_en
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14::timestamptz, NOW())
      )
      RETURNING *
    `,
    [
      data.empresa_id,
      data.empleado_id,
      data.sucursal_id,
      data.horario_id,
      data.tipo,
      data.estado,
      data.latitud,
      data.longitud,
      data.distancia_metros,
      data.dentro_geocerca,
      data.motivo_novedad,
      data.detalle_novedad,
      data.mensaje,
      data.marcado_en || null,
    ],
  );

  return result.rows[0];
}

async function assertDailyTipoLimit({ empresaId, empleadoId, tipo, markedAt = new Date() }) {
  const result = await pool.query(
    `
      SELECT id
      FROM marcaciones
      WHERE empresa_id = $1
        AND empleado_id = $2
        AND tipo = $3
        AND estado <> 'rechazada'
        AND (marcado_en AT TIME ZONE $5)::date = ($4::timestamptz AT TIME ZONE $5)::date
      LIMIT 1
    `,
    [empresaId, empleadoId, tipo, markedAt, REPORT_TIME_ZONE],
  );

  if (result.rows.length) {
    const error = new Error(`Ya existe una marcacion de ${tipo} para este empleado en la fecha indicada`);
    error.statusCode = 409;
    throw error;
  }
}

async function registrarMarcacion({ empresaId, auth, payload }) {
  validateMarcacionPayload(payload);

  const sucursal = await resolveSucursalByQr(empresaId, payload.qr_token);

  if (!sucursal || sucursal.estado !== 'activa') {
    const error = new Error('QR invalido o sucursal inactiva');
    error.statusCode = 400;
    throw error;
  }

  const empleado = await findEmpleadoForMarcacion({
    empresaId,
    empleadoId: payload.empleado_id,
    usuarioId: auth.usuario_id,
    rol: auth.rol,
  });

  if (!empleado) {
    const error = new Error('Empleado activo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const distancia = calculateDistanceMeters(
    { latitud: payload.latitud, longitud: payload.longitud },
    { latitud: sucursal.latitud, longitud: sucursal.longitud },
  );
  const precisionGps = Number(payload.precision_gps || payload.accuracy || 0);
  const toleranciaGps = Math.min(Math.max(precisionGps, GPS_TOLERANCIA_METROS), GPS_PRECISION_MAXIMA_METROS);
  const dentroGeocerca = distancia <= Number(sucursal.radio_metros) + toleranciaGps;
  const sucursalDistinta =
    empleado.sucursal_habitual_id && empleado.sucursal_habitual_id !== sucursal.id;
  const markedAt = payload.marcado_en || new Date();
  const horario = await findActiveHorario({
    empresaId,
    empleadoId: empleado.id,
    markedAt,
  });
  const reemplazoAutorizado = sucursalDistinta
    ? await reemplazoService.findActiveReemplazoForMarcacion({
        empresaId,
        empleadoId: empleado.id,
        sucursalId: sucursal.id,
        markedAt,
      })
    : null;

  let estado = 'aceptada';
  let mensaje = 'Marcacion aceptada';
  let motivoNovedad = null;
  let detalleNovedad = null;

  if (!dentroGeocerca) {
    estado = 'rechazada';
    mensaje = 'Marcacion rechazada: fuera del radio permitido';
  } else if (sucursalDistinta) {
    if (reemplazoAutorizado) {
      estado = 'aceptada_con_novedad';
      motivoNovedad = 'Reemplazo';
      detalleNovedad = reemplazoAutorizado.motivo;
      mensaje = 'Marcacion aceptada por reemplazo autorizado';
    } else if (!payload.motivo_novedad) {
      const error = new Error('motivo_novedad es requerido al marcar en sucursal distinta');
      error.statusCode = 400;
      throw error;
    } else {
      estado = 'aceptada_con_novedad';
      motivoNovedad = payload.motivo_novedad;
      detalleNovedad = payload.detalle_novedad || null;
      mensaje = 'Marcacion aceptada con novedad por sucursal distinta';
    }
  }

  if (estado !== 'rechazada') {
    await assertDailyTipoLimit({
      empresaId,
      empleadoId: empleado.id,
      tipo: payload.tipo,
      markedAt,
    });
  }

  const marcacion = await insertMarcacion({
    empresa_id: empresaId,
    empleado_id: empleado.id,
    sucursal_id: sucursal.id,
    horario_id: horario?.id || null,
    tipo: payload.tipo,
    estado,
    latitud: Number(payload.latitud),
    longitud: Number(payload.longitud),
    distancia_metros: Number(distancia.toFixed(2)),
    dentro_geocerca: dentroGeocerca,
    motivo_novedad: estado === 'aceptada_con_novedad' ? motivoNovedad : null,
    detalle_novedad: estado === 'aceptada_con_novedad' ? detalleNovedad : null,
    mensaje,
    marcado_en: payload.marcado_en,
  });

  return {
    marcacion,
    empleado,
    sucursal,
    horario,
  };
}

async function listMarcaciones({ empresaId, auth, empleadoId, sucursalId, estado, fechaDesde, fechaHasta, limit = 20, offset = 0 }) {
  const filters = ['m.empresa_id = $1'];
  const values = [empresaId];

  if (auth?.rol === 'EMPLEADO') {
    values.push(auth.usuario_id);
    filters.push(`e.usuario_id = $${values.length}`);
  }

  if (empleadoId && auth?.rol !== 'EMPLEADO') {
    values.push(empleadoId);
    filters.push(`m.empleado_id = $${values.length}`);
  }

  if (sucursalId) {
    values.push(sucursalId);
    filters.push(`m.sucursal_id = $${values.length}`);
  }

  if (estado) {
    values.push(estado);
    filters.push(`m.estado = $${values.length}`);
  }

  if (fechaDesde) {
    values.push(fechaDesde);
    filters.push(`m.marcado_en >= $${values.length}::timestamptz`);
  }

  if (fechaHasta) {
    values.push(fechaHasta);
    filters.push(`m.marcado_en <= $${values.length}::timestamptz`);
  }

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `
      SELECT
        m.*,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_nombre,
        h.nombre AS horario_nombre,
        COUNT(*) OVER() AS total
      FROM marcaciones m
      INNER JOIN empleados e ON e.id = m.empleado_id
      INNER JOIN sucursales s ON s.id = m.sucursal_id
      LEFT JOIN horarios h ON h.id = m.horario_id
      WHERE ${filters.join(' AND ')}
      ORDER BY m.marcado_en DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    items: result.rows.map(({ total, ...marcacion }) => marcacion),
    total: Number(result.rows[0]?.total || 0),
    limit,
    offset,
  };
}

async function findMarcacionById(empresaId, id) {
  const result = await pool.query(
    `
      SELECT
        m.*,
        e.codigo AS empleado_codigo,
        e.nombres AS empleado_nombres,
        e.apellidos AS empleado_apellidos,
        s.nombre AS sucursal_nombre,
        h.nombre AS horario_nombre
      FROM marcaciones m
      INNER JOIN empleados e ON e.id = m.empleado_id
      INNER JOIN sucursales s ON s.id = m.sucursal_id
      LEFT JOIN horarios h ON h.id = m.horario_id
      WHERE m.empresa_id = $1
        AND m.id = $2
      LIMIT 1
    `,
    [empresaId, id],
  );

  return result.rows[0] || null;
}

module.exports = {
  registrarMarcacion,
  listMarcaciones,
  findMarcacionById,
  assertDailyTipoLimit,
};
