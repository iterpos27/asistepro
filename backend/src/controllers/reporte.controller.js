const reporteService = require('../services/reporte.service');
const { toCsv } = require('../utils/csv.util');

function parsePagination(query) {
  const limit = Math.min(Number.parseInt(query.limit, 10) || 50, 500);
  const offset = Math.max(Number.parseInt(query.offset, 10) || 0, 0);

  return { limit, offset };
}

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

function todayDate() {
  const now = new Date();
  const guayaquilOffsetMs = 5 * 60 * 60 * 1000;

  return new Date(now.getTime() - guayaquilOffsetMs).toISOString().slice(0, 10);
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
    const { limit, offset } = parsePagination(req.query);
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

async function atrasos(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
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
      { key: 'primera_entrada', header: 'Primera entrada' },
      { key: 'ultima_salida', header: 'Ultima salida' },
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
      { key: 'marcado_en', header: 'Fecha' },
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
      { key: 'marcado_en', header: 'Fecha' },
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
  novedades,
  atrasos,
  exportarAsistenciaDiaria,
  exportarNovedades,
  exportarAtrasos,
};
