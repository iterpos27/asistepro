const reporteService = require('../services/reporte.service');
const { toCsv } = require('../utils/csv.util');
const { toExcelHtml } = require('../utils/excel.util');
const { parsePagination } = require('../utils/pagination.util');

const REPORT_TIME_ZONE = process.env.REPORT_TIME_ZONE || 'America/Guayaquil';
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: REPORT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

function todayDate() {
  const now = new Date();
  const guayaquilOffsetMs = 5 * 60 * 60 * 1000;

  return new Date(now.getTime() - guayaquilOffsetMs).toISOString().slice(0, 10);
}

function partsToObject(formatter, value) {
  return formatter.formatToParts(value).reduce((parts, part) => {
    if (part.type !== 'literal') parts[part.type] = part.value;
    return parts;
  }, {});
}

function parseDateValue(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const date = parseDateValue(value);
  return date ? date.toISOString().slice(0, 10) : String(value);
}

function formatDateTime(value) {
  const date = parseDateValue(value);
  if (!date) return value || '';

  const parts = partsToObject(dateTimeFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatTimeOnly(value) {
  const date = parseDateValue(value);
  if (!date) return value || '';

  const parts = partsToObject(timeFormatter, date);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatDecimalHours(value) {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) return '';
  const hours = Number(value);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

async function asistenciaDiaria(req, res, next) {
  try {
    const result = await reporteService.asistenciaDiaria({
      empresaId: getEmpresaId(req),
      fecha: req.query.fecha || todayDate(),
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      estado: req.query.estado,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function asistenciaMensual(req, res, next) {
  try {
    const month = req.query.mes || todayDate().slice(0, 7);
    const result = await reporteService.asistenciaMensual({
      empresaId: getEmpresaId(req),
      mes: month,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      estado: req.query.estado,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function novedades(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query, { maxLimit: 500, defaultLimit: 50 });
    const result = await reporteService.novedades({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function entradasSalidas(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query, { maxLimit: 500, defaultLimit: 100 });
    const result = await reporteService.entradasSalidas({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function atrasos(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query, { maxLimit: 500, defaultLimit: 50 });
    const result = await reporteService.atrasos({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      limit,
      offset,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function resumenEjecutivo(req, res, next) {
  try {
    const result = await reporteService.resumenEjecutivo({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function exportarAsistenciaDiaria(req, res, next) {
  try {
    const fecha = req.query.fecha || todayDate();
    const result = await reporteService.asistenciaDiaria({
      empresaId: getEmpresaId(req),
      fecha,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      estado: req.query.estado,
    });
    const csv = toCsv(result.items, [
      { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombres', header: 'Nombres' },
      { key: 'empleado_apellidos', header: 'Apellidos' },
      { key: 'sucursal_habitual_nombre', header: 'Sucursal habitual' },
      { key: 'primera_entrada', header: 'Primera entrada', format: formatDateTime },
      { key: 'ultima_salida', header: 'Ultima salida', format: formatDateTime },
      { key: 'horas_trabajadas', header: 'Horas trabajadas', format: formatDecimalHours },
      { key: 'minutos_trabajados', header: 'Minutos trabajados' },
      { key: 'marcaciones_validas', header: 'Marcaciones validas' },
      { key: 'novedades', header: 'Novedades' },
      { key: 'rechazadas', header: 'Rechazadas' },
      { key: 'estado_asistencia', header: 'Estado' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="asistencia-diaria-${fecha}.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

async function exportarEntradasSalidasExcel(req, res, next) {
  try {
    const result = await reporteService.entradasSalidas({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      limit: 1000,
      offset: 0,
    });
    const xls = toExcelHtml(
      result.items,
      [
        { key: 'fecha', header: 'Fecha', format: formatDateOnly },
        { key: 'empleado_codigo', header: 'Codigo' },
        { key: 'empleado_nombres', header: 'Nombres' },
        { key: 'empleado_apellidos', header: 'Apellidos' },
        { key: 'sucursal_habitual_nombre', header: 'Sucursal habitual' },
        { key: 'entrada', header: 'Entrada', format: formatTimeOnly },
        { key: 'salida', header: 'Salida', format: formatTimeOnly },
        { key: 'horas_trabajadas', header: 'Horas trabajadas', format: formatDecimalHours },
        { key: 'minutos_trabajados', header: 'Minutos trabajados' },
        { key: 'total_entradas', header: 'Total entradas' },
        { key: 'total_salidas', header: 'Total salidas' },
        { key: 'estado_jornada', header: 'Estado jornada' },
      ],
      'Entradas y salidas',
    );

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="entradas-salidas.xls"');
    return res.send(xls);
  } catch (error) {
    return next(error);
  }
}

async function exportarNovedades(req, res, next) {
  try {
    const result = await reporteService.novedades({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      limit: 500,
      offset: 0,
    });
    const csv = toCsv(result.items, [
      { key: 'marcado_en', header: 'Fecha', format: formatDateTime },
      { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombres', header: 'Nombres' },
      { key: 'empleado_apellidos', header: 'Apellidos' },
      { key: 'sucursal_nombre', header: 'Sucursal' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'motivo_novedad', header: 'Motivo' },
      { key: 'detalle_novedad', header: 'Detalle' },
      { key: 'distancia_metros', header: 'Distancia metros' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="novedades.csv"');
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

async function exportarAtrasos(req, res, next) {
  try {
    const result = await reporteService.atrasos({
      empresaId: getEmpresaId(req),
      fechaDesde: req.query.fecha_desde,
      fechaHasta: req.query.fecha_hasta,
      sucursalId: req.query.sucursal_id,
      empleadoId: req.query.empleado_id,
      limit: 500,
      offset: 0,
    });
    const csv = toCsv(result.items, [
      { key: 'marcado_en', header: 'Fecha', format: formatDateTime },
      { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombres', header: 'Nombres' },
      { key: 'empleado_apellidos', header: 'Apellidos' },
      { key: 'sucursal_nombre', header: 'Sucursal' },
      { key: 'horario_nombre', header: 'Horario' },
      { key: 'hora_inicio', header: 'Hora inicio' },
      { key: 'tolerancia_minutos', header: 'Tolerancia minutos' },
      { key: 'minutos_atraso', header: 'Minutos atraso' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="atrasos.csv"');
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  asistenciaDiaria,
  asistenciaMensual,
  entradasSalidas,
  novedades,
  atrasos,
  resumenEjecutivo,
  exportarAsistenciaDiaria,
  exportarEntradasSalidasExcel,
  exportarNovedades,
  exportarAtrasos,
};
