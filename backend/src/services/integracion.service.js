const crypto = require('crypto');
const ExcelJS = require('exceljs');

const { pool } = require('../config/database');
const laboralService = require('./laboral.service');
const { getStorageStatus } = require('./storage.service');

const INTEGRATION_TYPES = ['nomina', 'biometrico', 'storage'];
const INTEGRATION_STATES = ['activa', 'inactiva', 'error'];
const MARK_TYPES = ['entrada', 'salida'];
const NOMINA_PLANTILLAS = ['detalle_diario', 'resumen_mensual', 'cliente'];

function hashApiKey(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizePayload(payload) {
  if (!payload.nombre?.trim()) {
    const error = new Error('nombre es requerido');
    error.statusCode = 400;
    throw error;
  }
  if (!INTEGRATION_TYPES.includes(payload.tipo)) {
    const error = new Error('tipo de integracion invalido');
    error.statusCode = 400;
    throw error;
  }
  if (!payload.proveedor?.trim()) {
    const error = new Error('proveedor es requerido');
    error.statusCode = 400;
    throw error;
  }
  if (payload.estado && !INTEGRATION_STATES.includes(payload.estado)) {
    const error = new Error('estado invalido');
    error.statusCode = 400;
    throw error;
  }

  return {
    nombre: payload.nombre.trim(),
    tipo: payload.tipo,
    proveedor: payload.proveedor.trim(),
    estado: payload.estado || 'activa',
    api_key_hash: payload.api_key ? hashApiKey(payload.api_key) : undefined,
    configuracion: payload.configuracion && typeof payload.configuracion === 'object' ? payload.configuracion : {},
  };
}

async function listIntegraciones(empresaId) {
  const [items, logs] = await Promise.all([
    pool.query(
      `SELECT * FROM integraciones_externas WHERE empresa_id = $1 ORDER BY creado_en DESC`,
      [empresaId],
    ),
    pool.query(
      `SELECT * FROM integracion_ejecuciones WHERE empresa_id = $1 ORDER BY creado_en DESC LIMIT 20`,
      [empresaId],
    ),
  ]);

  return {
    items: items.rows,
    ejecuciones: logs.rows,
    storage: getStorageStatus(),
  };
}

async function findIntegracion(empresaId, id) {
  const result = await pool.query(
    `SELECT * FROM integraciones_externas WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, id],
  );
  return result.rows[0] || null;
}

async function saveIntegracion({ empresaId, usuarioId, payload, id = null }) {
  const item = normalizePayload(payload);

  if (id) {
    const result = await pool.query(
      `
        UPDATE integraciones_externas
        SET nombre = $3,
            tipo = $4,
            proveedor = $5,
            estado = $6,
            api_key_hash = COALESCE($7, api_key_hash),
            configuracion = $8::jsonb,
            actualizado_por = $9,
            actualizado_en = NOW()
        WHERE empresa_id = $1
          AND id = $2
        RETURNING *
      `,
      [
        empresaId,
        id,
        item.nombre,
        item.tipo,
        item.proveedor,
        item.estado,
        item.api_key_hash,
        JSON.stringify(item.configuracion),
        usuarioId,
      ],
    );
    return result.rows[0] || null;
  }

  const result = await pool.query(
    `
      INSERT INTO integraciones_externas (
        empresa_id, nombre, tipo, proveedor, estado, api_key_hash, configuracion, creado_por, actualizado_por
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8
      )
      RETURNING *
    `,
    [
      empresaId,
      item.nombre,
      item.tipo,
      item.proveedor,
      item.estado,
      item.api_key_hash || null,
      JSON.stringify(item.configuracion),
      usuarioId,
    ],
  );
  return result.rows[0];
}

async function deactivateIntegracion(empresaId, id, usuarioId) {
  const result = await pool.query(
    `
      UPDATE integraciones_externas
      SET estado = 'inactiva',
          actualizado_por = $3,
          actualizado_en = NOW()
      WHERE empresa_id = $1 AND id = $2
      RETURNING *
    `,
    [empresaId, id, usuarioId],
  );
  return result.rows[0] || null;
}

async function logExecution({ integracionId, empresaId, usuarioId, accion, estado, resumen = {}, errores = [] }) {
  const result = await pool.query(
    `
      INSERT INTO integracion_ejecuciones (integracion_id, empresa_id, ejecutado_por, accion, estado, resumen, errores)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      RETURNING *
    `,
    [integracionId, empresaId, usuarioId, accion, estado, JSON.stringify(resumen), JSON.stringify(errores)],
  );

  await pool.query(
    `
      UPDATE integraciones_externas
      SET ultima_sincronizacion_en = NOW(),
          ultima_ejecucion_estado = $3,
          ultima_ejecucion_resumen = $4::jsonb,
          actualizado_en = NOW()
      WHERE empresa_id = $1
        AND id = $2
    `,
    [empresaId, integracionId, estado, JSON.stringify(resumen)],
  );

  return result.rows[0];
}

async function assertActiveEmployeeByCode(client, empresaId, codigo) {
  const result = await client.query(
    `SELECT id FROM empleados WHERE empresa_id = $1 AND UPPER(codigo) = UPPER($2) AND estado = 'activo' LIMIT 1`,
    [empresaId, codigo],
  );
  if (!result.rows.length) {
    const error = new Error(`Empleado no encontrado: ${codigo}`);
    error.statusCode = 400;
    throw error;
  }
  return result.rows[0].id;
}

async function assertSucursal(client, empresaId, sucursalId) {
  const result = await client.query(`SELECT id FROM sucursales WHERE empresa_id = $1 AND id = $2 LIMIT 1`, [empresaId, sucursalId]);
  if (!result.rows.length) {
    const error = new Error('Sucursal de integracion no encontrada');
    error.statusCode = 400;
    throw error;
  }
}

async function assertMarkLimit(client, empresaId, empleadoId, tipo, marcadoEn) {
  const result = await client.query(
    `
      SELECT id
      FROM marcaciones
      WHERE empresa_id = $1
        AND empleado_id = $2
        AND tipo = $3
        AND estado <> 'rechazada'
        AND anulada = FALSE
        AND (marcado_en AT TIME ZONE 'America/Guayaquil')::date = ($4::timestamptz AT TIME ZONE 'America/Guayaquil')::date
      LIMIT 1
    `,
    [empresaId, empleadoId, tipo, marcadoEn],
  );
  if (result.rows.length) {
    const error = new Error(`Ya existe una marcacion de ${tipo} para la fecha ${String(marcadoEn).slice(0, 10)}`);
    error.statusCode = 409;
    throw error;
  }
}

async function syncBiometrico({ empresaId, usuarioId, integracion, payload }) {
  const marks = Array.isArray(payload?.marcaciones) ? payload.marcaciones : [];
  if (!marks.length) {
    const error = new Error('Debe enviar marcaciones para sincronizar');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  let inserted = 0;
  const errors = [];
  try {
    await client.query('BEGIN');
    for (const mark of marks) {
      await client.query(`SAVEPOINT mark_sync`);
      try {
        const tipo = MARK_TYPES.includes(mark.tipo) ? mark.tipo : null;
        if (!tipo) throw new Error('tipo de marcacion invalido');
        const marcadoEn = mark.marcado_en || mark.fecha_hora;
        if (!marcadoEn) throw new Error('marcado_en es requerido');
        const empleadoId = await assertActiveEmployeeByCode(client, empresaId, mark.empleado_codigo);
        const sucursalId = mark.sucursal_id || integracion.configuracion?.sucursal_id;
        await assertSucursal(client, empresaId, sucursalId);
        await laboralService.assertPeriodoAbierto(empresaId, marcadoEn, client);
        await assertMarkLimit(client, empresaId, empleadoId, tipo, marcadoEn);

        await client.query(
          `
            INSERT INTO marcaciones (
              empresa_id, empleado_id, sucursal_id, tipo, estado, latitud, longitud, distancia_metros,
              dentro_geocerca, motivo_novedad, detalle_novedad, mensaje, marcado_en, origen
            ) VALUES (
              $1, $2, $3, $4, 'aceptada', 0, 0, 0, TRUE, NULL, NULL, $5, $6::timestamptz, 'biometrico'
            )
          `,
          [empresaId, empleadoId, sucursalId, tipo, `Marcacion sincronizada desde ${integracion.proveedor}`, marcadoEn],
        );
        inserted += 1;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT mark_sync`);
        errors.push({ empleado_codigo: mark.empleado_codigo || null, motivo: error.message });
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const estado = errors.length ? inserted ? 'warning' : 'error' : 'ok';
  const resumen = { sincronizadas: inserted, rechazadas: errors.length };
  await logExecution({ integracionId: integracion.id, empresaId, usuarioId, accion: 'sincronizar_biometrico', estado, resumen, errores: errors });
  return { resumen, errores: errors };
}

async function exportNomina({ empresaId, usuarioId, integracion, payload }) {
  const mes = payload?.mes || new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  const calculo = await laboralService.getCalculo({ empresaId, mes });
  const rows = buildNominaRows({ calculo, integracion, payload, mes });
  const resumen = { mes, filas: rows.length };
  await logExecution({ integracionId: integracion.id, empresaId, usuarioId, accion: 'exportar_nomina', estado: 'ok', resumen });
  return { resumen, items: rows };
}

function groupMonthlyRows(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.empleado_codigo;
    if (!groups.has(key)) {
      groups.set(key, {
        codigo: item.empleado_codigo,
        nombre: item.empleado_nombre,
        jornadas: 0,
        minutos_ordinarios: 0,
        minutos_extra: 0,
        minutos_atraso: 0,
        ausencias: 0,
        justificaciones: 0,
      });
    }
    const current = groups.get(key);
    current.jornadas += 1;
    current.minutos_ordinarios += Number(item.minutos_ordinarios || 0);
    current.minutos_extra += Number(item.minutos_extra || 0);
    current.minutos_atraso += Number(item.minutos_atraso || 0);
    if (item.estado === 'ausente') current.ausencias += 1;
    if (item.estado === 'justificada') current.justificaciones += 1;
  }
  return [...groups.values()];
}

function getNominaColumns({ integracion, payload, sampleRows }) {
  const configuracion = integracion.configuracion || {};
  const plantilla = payload?.plantilla || configuracion.nomina_plantilla || 'detalle_diario';

  if (!NOMINA_PLANTILLAS.includes(plantilla)) {
    const error = new Error('Plantilla de nomina invalida');
    error.statusCode = 400;
    throw error;
  }

  if (plantilla === 'resumen_mensual') {
    return {
      plantilla,
      columns: [
        { key: 'codigo', label: 'Codigo' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'jornadas', label: 'Jornadas' },
        { key: 'minutos_ordinarios', label: 'Minutos ordinarios' },
        { key: 'minutos_extra', label: 'Minutos extra' },
        { key: 'minutos_atraso', label: 'Minutos atraso' },
        { key: 'ausencias', label: 'Ausencias' },
        { key: 'justificaciones', label: 'Justificaciones' },
      ],
    };
  }

  if (plantilla === 'cliente') {
    const configuredColumns = Array.isArray(configuracion.nomina_columnas)
      ? configuracion.nomina_columnas
      : [];
    const availableKeys = new Set(sampleRows.flatMap((row) => Object.keys(row)));
    const columns = configuredColumns
      .filter((column) => column?.key && availableKeys.has(column.key))
      .map((column) => ({ key: column.key, label: column.label || column.key }));
    if (!columns.length) {
      const error = new Error('La integracion no tiene columnas configuradas para la plantilla del cliente');
      error.statusCode = 400;
      throw error;
    }
    return { plantilla, columns };
  }

  return {
    plantilla,
    columns: [
      { key: 'codigo', label: 'Codigo' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'entrada', label: 'Entrada' },
      { key: 'salida', label: 'Salida' },
      { key: 'minutos_ordinarios', label: 'Minutos ordinarios' },
      { key: 'minutos_extra', label: 'Minutos extra' },
      { key: 'minutos_atraso', label: 'Minutos atraso' },
      { key: 'estado', label: 'Estado' },
      { key: 'justificacion', label: 'Justificacion' },
    ],
  };
}

function buildNominaRows({ calculo, integracion, payload, mes }) {
  const detalleRows = calculo.items.map((item) => ({
    codigo: item.empleado_codigo,
    nombre: item.empleado_nombre,
    fecha: item.fecha,
    entrada: item.entrada,
    salida: item.salida,
    minutos_ordinarios: item.minutos_ordinarios,
    minutos_extra: item.minutos_extra,
    minutos_atraso: item.minutos_atraso,
    estado: item.estado,
    justificacion: item.justificacion,
    mes,
    proveedor: integracion.proveedor,
  }));

  const monthlyRows = groupMonthlyRows(calculo.items).map((item) => ({
    ...item,
    mes,
    proveedor: integracion.proveedor,
  }));

  const { plantilla } = getNominaColumns({
    integracion,
    payload,
    sampleRows: monthlyRows.length ? monthlyRows : detalleRows,
  });

  return plantilla === 'resumen_mensual' ? monthlyRows : detalleRows;
}

function formatCell(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toCsv({ rows, columns, delimiter = ',' }) {
  const escapeCell = (value) => `"${formatCell(value).replace(/"/g, '""')}"`;
  return [columns.map((column) => escapeCell(column.label)).join(delimiter)]
    .concat(rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(delimiter)))
    .join('\n');
}

async function toXlsxBuffer({ rows, columns, sheetName = 'Nomina' }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({ header: column.label, key: column.key, width: Math.max(14, column.label.length + 2) }));
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

async function exportNominaFile({ empresaId, usuarioId, integracion, payload }) {
  const mes = payload?.mes || new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  const calculo = await laboralService.getCalculo({ empresaId, mes });
  const rows = buildNominaRows({ calculo, integracion, payload, mes });
  const { plantilla, columns } = getNominaColumns({
    integracion,
    payload,
    sampleRows: rows,
  });
  const fileType = payload?.tipo_archivo === 'xlsx' ? 'xlsx' : 'csv';
  const fileName = `nomina-${integracion.proveedor}-${plantilla}-${mes}.${fileType}`;
  const resumen = { mes, filas: rows.length, plantilla, tipo_archivo: fileType };
  await logExecution({ integracionId: integracion.id, empresaId, usuarioId, accion: 'descargar_nomina', estado: 'ok', resumen });

  if (fileType === 'xlsx') {
    return {
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await toXlsxBuffer({ rows, columns, sheetName: `Nomina ${mes}` })),
    };
  }

  return {
    fileName,
    contentType: 'text/csv; charset=utf-8',
    buffer: Buffer.from(toCsv({
      rows,
      columns,
      delimiter: integracion.configuracion?.nomina_delimitador || ',',
    }), 'utf8'),
  };
}

async function testStorage({ empresaId, usuarioId, integracion }) {
  const resumen = { proveedor: integracion.proveedor, storage: getStorageStatus() };
  await logExecution({ integracionId: integracion.id, empresaId, usuarioId, accion: 'validar_storage', estado: 'ok', resumen });
  return resumen;
}

async function runIntegration({ empresaId, usuarioId, id, payload }) {
  const integracion = await findIntegracion(empresaId, id);
  if (!integracion) {
    const error = new Error('Integracion no encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (integracion.tipo === 'biometrico') {
    return syncBiometrico({ empresaId, usuarioId, integracion, payload });
  }
  if (integracion.tipo === 'nomina') {
    return exportNomina({ empresaId, usuarioId, integracion, payload });
  }
  return testStorage({ empresaId, usuarioId, integracion, payload });
}

async function downloadIntegrationFile({ empresaId, usuarioId, id, payload }) {
  const integracion = await findIntegracion(empresaId, id);
  if (!integracion) {
    const error = new Error('Integracion no encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (integracion.tipo === 'nomina') {
    return exportNominaFile({ empresaId, usuarioId, integracion, payload });
  }

  const error = new Error('La integracion no soporta exportacion de archivo');
  error.statusCode = 400;
  throw error;
}

module.exports = {
  deactivateIntegracion,
  downloadIntegrationFile,
  findIntegracion,
  listIntegraciones,
  runIntegration,
  saveIntegracion,
};
