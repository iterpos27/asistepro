const { pool } = require('../config/database');

const TIME_ZONE = 'America/Guayaquil';

function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { first, last: `${month}-${String(lastDay).padStart(2, '0')}`, year, monthNumber, lastDay };
}

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function durationMinutes(start, end) {
  if (start === null || end === null) return 0;
  return end >= start ? end - start : end + 1440 - start;
}

function localToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function monthDates({ year, monthNumber, lastDay }, maximumDate = null) {
  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const date = new Date(Date.UTC(year, monthNumber - 1, day));
    return {
      value: `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      weekday: date.getUTCDay() === 0 ? 7 : date.getUTCDay(),
    };
  }).filter((date) => !maximumDate || date.value <= maximumDate);
}

async function assertPeriodoAbierto(empresaId, dateValue, client = pool) {
  const result = await client.query(
    `SELECT id FROM cierres_mensuales WHERE empresa_id = $1
     AND mes = CASE WHEN $2::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN LEFT($2::text, 7)
                    ELSE TO_CHAR($2::timestamptz AT TIME ZONE $3, 'YYYY-MM') END
     AND estado = 'cerrado' LIMIT 1`,
    [empresaId, dateValue, TIME_ZONE],
  );
  if (result.rows.length) {
    const error = new Error('El periodo mensual esta cerrado y no admite cambios');
    error.statusCode = 409;
    throw error;
  }
}

async function calcularPrenominaDesdeDetalle(empresaId, detalle) {
  if (!detalle || !detalle.length) return [];
  const employeeIds = [...new Set(detalle.map((d) => d.empleado_id))];
  if (!employeeIds.length) return [];

  const employeesResult = await pool.query(
    `SELECT id, salario_base FROM empleados WHERE id = ANY($1)`,
    [employeeIds]
  );
  const salaryMap = new Map(employeesResult.rows.map((r) => [r.id, Number(r.salario_base || 0)]));

  const empMap = new Map();
  for (const item of detalle) {
    if (!empMap.has(item.empleado_id)) {
      empMap.set(item.empleado_id, {
        empleado_id: item.empleado_id,
        empleado_codigo: item.empleado_codigo,
        empleado_nombre: item.empleado_nombre,
        ausencias: 0,
        minutos_atraso: 0,
        minutos_extra: 0,
        minutos_trabajados: 0,
      });
    }
    const e = empMap.get(item.empleado_id);
    if (item.estado === 'ausente') e.ausencias++;
    e.minutos_atraso += item.minutos_atraso || 0;
    e.minutos_extra += item.minutos_extra || 0;
    e.minutos_trabajados += item.minutos_trabajados || 0;
  }

  const prenomina = [];
  for (const e of empMap.values()) {
    const salarioBase = salaryMap.get(e.empleado_id) || 0;
    let descuentoAusencias = 0;
    let descuentoAtrasos = 0;
    let pagoHorasExtra = 0;
    let netoPagar = 0;

    if (salarioBase > 0) {
      const tarifaPorHora = salarioBase / 240;
      const tarifaPorMinuto = tarifaPorHora / 60;
      const tarifaHoraExtra = tarifaPorHora * 1.5;

      descuentoAusencias = e.ausencias * (salarioBase / 30);
      descuentoAtrasos = e.minutos_atraso * tarifaPorMinuto;
      pagoHorasExtra = (e.minutos_extra / 60) * tarifaHoraExtra;
      netoPagar = Math.max(0, salarioBase - descuentoAusencias - descuentoAtrasos + pagoHorasExtra);
    }

    prenomina.push({
      ...e,
      salario_base: salarioBase,
      descuento_ausencias: Number(descuentoAusencias.toFixed(2)),
      descuento_atrasos: Number(descuentoAtrasos.toFixed(2)),
      pago_horas_extra: Number(pagoHorasExtra.toFixed(2)),
      neto_pagar: Number(netoPagar.toFixed(2)),
    });
  }
  return prenomina;
}

async function calcularMes({ empresaId, mes }) {
  const range = monthRange(mes);
  const today = localToday();
  const maximumDate = mes > today.slice(0, 7) ? `${mes}-00` : mes === today.slice(0, 7) ? today : range.last;
  const [employeesResult, schedulesResult, marksResult, requestsResult] = await Promise.all([
    pool.query(
      `SELECT id, codigo, nombres, apellidos, sucursal_habitual_id, salario_base FROM empleados WHERE empresa_id = $1 AND estado = 'activo' ORDER BY codigo`,
      [empresaId],
    ),
    pool.query(
      `SELECT eh.empleado_id, eh.fecha_inicio::text, eh.fecha_fin::text, h.nombre AS horario_nombre,
              h.dias_semana, h.hora_inicio::text, h.hora_fin::text, h.tolerancia_minutos, h.descanso_minutos
       FROM empleado_horarios eh
       INNER JOIN horarios h ON h.id = eh.horario_id
       WHERE eh.empresa_id = $1 AND eh.activo = TRUE AND h.activo = TRUE
         AND eh.fecha_inicio <= $3::date AND (eh.fecha_fin IS NULL OR eh.fecha_fin >= $2::date)
       ORDER BY eh.fecha_inicio DESC`,
      [empresaId, range.first, range.last],
    ),
    pool.query(
      `SELECT m.empleado_id,
              TO_CHAR(m.marcado_en AT TIME ZONE $4, 'YYYY-MM-DD') AS fecha,
              MIN(TO_CHAR(m.marcado_en AT TIME ZONE $4, 'HH24:MI:SS')) FILTER (WHERE m.tipo = 'entrada') AS entrada,
              MAX(TO_CHAR(m.marcado_en AT TIME ZONE $4, 'HH24:MI:SS')) FILTER (WHERE m.tipo = 'salida') AS salida
       FROM marcaciones m
       WHERE m.empresa_id = $1 AND m.anulada = FALSE AND m.estado <> 'rechazada'
         AND (m.marcado_en AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
       GROUP BY m.empleado_id, TO_CHAR(m.marcado_en AT TIME ZONE $4, 'YYYY-MM-DD')`,
      [empresaId, range.first, range.last, TIME_ZONE],
    ),
    pool.query(
      `SELECT empleado_id, tipo, fecha_inicio::text, fecha_fin::text
       FROM solicitudes WHERE empresa_id = $1 AND estado = 'aprobada'
         AND tipo IN ('vacaciones', 'permiso', 'incapacidad', 'ausencia')
         AND fecha_inicio <= $3::date AND fecha_fin >= $2::date`,
      [empresaId, range.first, range.last],
    ),
  ]);

  const schedulesByEmployee = new Map();
  for (const schedule of schedulesResult.rows) {
    if (!schedulesByEmployee.has(schedule.empleado_id)) schedulesByEmployee.set(schedule.empleado_id, []);
    schedulesByEmployee.get(schedule.empleado_id).push(schedule);
  }
  const marks = new Map(marksResult.rows.map((row) => [`${row.empleado_id}:${row.fecha}`, row]));
  const requestsByEmployee = new Map();
  for (const request of requestsResult.rows) {
    if (!requestsByEmployee.has(request.empleado_id)) requestsByEmployee.set(request.empleado_id, []);
    requestsByEmployee.get(request.empleado_id).push(request);
  }

  const items = [];
  for (const employee of employeesResult.rows) {
    for (const date of monthDates(range, maximumDate)) {
      const schedule = (schedulesByEmployee.get(employee.id) || []).find((item) =>
        item.fecha_inicio <= date.value && (!item.fecha_fin || item.fecha_fin >= date.value) && item.dias_semana.includes(date.weekday));
      const mark = marks.get(`${employee.id}:${date.value}`);
      const request = (requestsByEmployee.get(employee.id) || []).find((item) => item.fecha_inicio <= date.value && item.fecha_fin >= date.value);
      if (!schedule && !mark && !request) continue;

      const scheduledStart = timeToMinutes(schedule?.hora_inicio);
      const scheduledEnd = timeToMinutes(schedule?.hora_fin);
      const breakMinutes = Number(schedule?.descanso_minutos || 0);
      const scheduledMinutes = Math.max(0, durationMinutes(scheduledStart, scheduledEnd) - breakMinutes);
      const entry = timeToMinutes(mark?.entrada);
      const exit = timeToMinutes(mark?.salida);
      const workedMinutes = entry !== null && exit !== null ? Math.max(0, durationMinutes(entry, exit) - breakMinutes) : 0;
      const lateMinutes = entry !== null && scheduledStart !== null
        ? Math.max(0, entry - scheduledStart - Number(schedule?.tolerancia_minutos || 0))
        : 0;
      const status = request ? 'justificada' : !schedule ? 'sin_horario' : !mark ? 'ausente' : !mark.entrada || !mark.salida ? 'incompleta' : 'completa';

      items.push({
        fecha: date.value,
        empleado_id: employee.id,
        empleado_codigo: employee.codigo,
        empleado_nombre: `${employee.nombres} ${employee.apellidos || ''}`.trim(),
        horario: schedule?.horario_nombre || null,
        entrada: mark?.entrada || null,
        salida: mark?.salida || null,
        minutos_programados: scheduledMinutes,
        minutos_trabajados: workedMinutes,
        minutos_ordinarios: Math.min(workedMinutes, scheduledMinutes || workedMinutes),
        minutos_extra: scheduledMinutes ? Math.max(0, workedMinutes - scheduledMinutes) : 0,
        minutos_atraso: lateMinutes,
        estado: status,
        justificacion: request?.tipo || null,
      });
    }
  }

  const resumen = items.reduce((acc, item) => {
    acc.minutos_programados += item.minutos_programados;
    acc.minutos_trabajados += item.minutos_trabajados;
    acc.minutos_ordinarios += item.minutos_ordinarios;
    acc.minutos_extra += item.minutos_extra;
    acc.minutos_atraso += item.minutos_atraso;
    acc.jornadas_completas += item.estado === 'completa' ? 1 : 0;
    acc.jornadas_incompletas += item.estado === 'incompleta' ? 1 : 0;
    acc.ausencias += item.estado === 'ausente' ? 1 : 0;
    acc.ausencias_justificadas += item.estado === 'justificada' ? 1 : 0;
    return acc;
  }, { empleados: employeesResult.rows.length, minutos_programados: 0, minutos_trabajados: 0, minutes_ordinarios: 0, minutos_ordinarios: 0, minutos_extra: 0, minutos_atraso: 0, jornadas_completas: 0, jornadas_incompletas: 0, ausencias: 0, ausencias_justificadas: 0 });

  const prenomina = [];
  for (const employee of employeesResult.rows) {
    const empItems = items.filter((item) => item.empleado_id === employee.id);
    const salarioBase = Number(employee.salario_base || 0);
    const ausencias = empItems.filter((item) => item.estado === 'ausente').length;
    const minutosAtraso = empItems.reduce((acc, item) => acc + item.minutos_atraso, 0);
    const minutosExtra = empItems.reduce((acc, item) => acc + item.minutos_extra, 0);
    const minutosTrabajados = empItems.reduce((acc, item) => acc + item.minutos_trabajados, 0);

    let descuentoAusencias = 0;
    let descuentoAtrasos = 0;
    let pagoHorasExtra = 0;
    let netoPagar = 0;

    if (salarioBase > 0) {
      const tarifaPorHora = salarioBase / 240;
      const tarifaPorMinuto = tarifaPorHora / 60;
      const tarifaHoraExtra = tarifaPorHora * 1.5;

      descuentoAusencias = ausencias * (salarioBase / 30);
      descuentoAtrasos = minutosAtraso * tarifaPorMinuto;
      pagoHorasExtra = (minutosExtra / 60) * tarifaHoraExtra;
      netoPagar = Math.max(0, salarioBase - descuentoAusencias - descuentoAtrasos + pagoHorasExtra);
    }

    prenomina.push({
      empleado_id: employee.id,
      empleado_codigo: employee.codigo,
      empleado_nombre: `${employee.nombres} ${employee.apellidos || ''}`.trim(),
      salario_base: salarioBase,
      ausencias,
      minutos_atraso: minutosAtraso,
      minutos_extra: minutosExtra,
      minutos_trabajados: minutosTrabajados,
      descuento_ausencias: Number(descuentoAusencias.toFixed(2)),
      descuento_atrasos: Number(descuentoAtrasos.toFixed(2)),
      pago_horas_extra: Number(pagoHorasExtra.toFixed(2)),
      neto_pagar: Number(netoPagar.toFixed(2)),
    });
  }

  return { mes, resumen, items, prenomina };
}

async function getCalculo({ empresaId, mes }) {
  const closure = await pool.query(`SELECT * FROM cierres_mensuales WHERE empresa_id = $1 AND mes = $2 LIMIT 1`, [empresaId, mes]);
  if (closure.rows[0]?.estado === 'cerrado') {
    const prenomina = closure.rows[0].resumen?.prenomina || await calcularPrenominaDesdeDetalle(empresaId, closure.rows[0].detalle);
    return { mes, resumen: closure.rows[0].resumen, items: closure.rows[0].detalle, prenomina, cierre: closure.rows[0] };
  }
  const calculation = await calcularMes({ empresaId, mes });
  return { ...calculation, cierre: closure.rows[0] || null };
}

async function cerrarMes({ empresaId, mes, usuarioId }) {
  const range = monthRange(mes);
  if (range.last > localToday()) {
    const error = new Error('Solo puede cerrar un mes cuando haya finalizado');
    error.statusCode = 409;
    throw error;
  }
  const calculation = await calcularMes({ empresaId, mes });
  const resumenGuardar = {
    ...calculation.resumen,
    prenomina: calculation.prenomina,
  };
  const result = await pool.query(
    `INSERT INTO cierres_mensuales (empresa_id, mes, estado, resumen, detalle, cerrado_por)
     VALUES ($1, $2, 'cerrado', $3::jsonb, $4::jsonb, $5)
     ON CONFLICT (empresa_id, mes) DO UPDATE SET estado = 'cerrado', resumen = EXCLUDED.resumen,
       detalle = EXCLUDED.detalle, cerrado_por = EXCLUDED.cerrado_por, cerrado_en = NOW(),
       reabierto_por = NULL, reabierto_en = NULL, motivo_reapertura = NULL
     RETURNING *`,
    [empresaId, mes, JSON.stringify(resumenGuardar), JSON.stringify(calculation.items), usuarioId],
  );
  return result.rows[0];
}

async function reabrirMes({ empresaId, mes, usuarioId, motivo }) {
  const result = await pool.query(
    `UPDATE cierres_mensuales SET estado = 'reabierto', reabierto_por = $3, reabierto_en = NOW(), motivo_reapertura = $4
     WHERE empresa_id = $1 AND mes = $2 AND estado = 'cerrado' RETURNING *`,
    [empresaId, mes, usuarioId, motivo],
  );
  if (!result.rows[0]) { const error = new Error('No existe un cierre activo para ese mes'); error.statusCode = 404; throw error; }
  return result.rows[0];
}

async function listCierres(empresaId) {
  const result = await pool.query(
    `SELECT c.*, u.nombre AS cerrado_por_nombre, u.apellido AS cerrado_por_apellido
     FROM cierres_mensuales c LEFT JOIN usuarios u ON u.id = c.cerrado_por
     WHERE c.empresa_id = $1 ORDER BY c.mes DESC LIMIT 36`, [empresaId]);
  return result.rows;
}

module.exports = { assertPeriodoAbierto, calcularMes, cerrarMes, getCalculo, listCierres, reabrirMes };
