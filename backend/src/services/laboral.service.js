const { pool } = require('../config/database');

const TIME_ZONE = 'America/Guayaquil';
const PROFESSIONAL_SERVICE_TYPES = ['servicios profesionales', 'servicios profesionales / bajo factura', 'bajo factura'];

const DEFAULT_RULES = {
  jornada_diaria_minutos: 480,
  jornada_semanal_minutos: 2400,
  base_calculo_mensual_horas: 240,
  dias_base_mes: 30,
  tolerancia_atraso_minutos: 0,
  almuerzo_minutos: 60,
  almuerzo_inicio: '12:00',
  almuerzo_fin: '15:00',
  descontar_almuerzo_automatico: true,
  hora_inicio_nocturna: '19:00',
  hora_fin_nocturna: '06:00',
  recargo_suplementaria: 1.5,
  recargo_extraordinaria: 2,
  recargo_nocturna: 1.25,
  recargo_feriado: 2,
  redondeo_minutos: 1,
  ausencia_permiso_pagado: true,
  ausencia_incapacidad_pagada: true,
  activo: true,
};

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

function normalizeRules(row = {}) {
  const merged = { ...DEFAULT_RULES, ...row };
  return {
    ...merged,
    jornada_diaria_minutos: Number(merged.jornada_diaria_minutos),
    jornada_semanal_minutos: Number(merged.jornada_semanal_minutos),
    base_calculo_mensual_horas: Number(merged.base_calculo_mensual_horas),
    dias_base_mes: Number(merged.dias_base_mes),
    tolerancia_atraso_minutos: Number(merged.tolerancia_atraso_minutos),
    almuerzo_minutos: Number(merged.almuerzo_minutos),
    almuerzo_inicio: String(merged.almuerzo_inicio).slice(0, 5),
    almuerzo_fin: String(merged.almuerzo_fin).slice(0, 5),
    hora_inicio_nocturna: String(merged.hora_inicio_nocturna).slice(0, 5),
    hora_fin_nocturna: String(merged.hora_fin_nocturna).slice(0, 5),
    recargo_suplementaria: Number(merged.recargo_suplementaria),
    recargo_extraordinaria: Number(merged.recargo_extraordinaria),
    recargo_nocturna: Number(merged.recargo_nocturna),
    recargo_feriado: Number(merged.recargo_feriado),
    redondeo_minutos: Number(merged.redondeo_minutos),
    descontar_almuerzo_automatico: merged.descontar_almuerzo_automatico !== false,
    ausencia_permiso_pagado: merged.ausencia_permiso_pagado !== false,
    ausencia_incapacidad_pagada: merged.ausencia_incapacidad_pagada !== false,
    activo: merged.activo !== false,
  };
}

function overlapMinutes(start, end, windowStart, windowEnd) {
  if (start === null || end === null || windowStart === null || windowEnd === null) return 0;
  const normalizedEnd = end >= start ? end : end + 1440;
  const windowEndNormalized = windowEnd > windowStart ? windowEnd : windowEnd + 1440;
  const windows = [
    [windowStart, windowEndNormalized],
    [windowStart + 1440, windowEndNormalized + 1440],
  ];
  return windows.reduce((total, [currentStart, currentEnd]) => {
    const overlapStart = Math.max(start, currentStart);
    const overlapEnd = Math.min(normalizedEnd, currentEnd);
    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0);
}

function lunchBreakMinutes(start, end, configuredBreak, rules) {
  if (!rules.descontar_almuerzo_automatico) return 0;
  const configured = Number(configuredBreak || rules.almuerzo_minutos || 0);
  if (!configured) return 0;
  return Math.min(configured, overlapMinutes(start, end, timeToMinutes(rules.almuerzo_inicio), timeToMinutes(rules.almuerzo_fin)));
}

function explicitLunchBreakMinutes(lunchOut, lunchIn) {
  const start = timeToMinutes(lunchOut);
  const end = timeToMinutes(lunchIn);
  if (start === null || end === null) return null;
  return durationMinutes(start, end);
}

function nightMinutes(entry, exit, lunchOut, lunchIn, rules) {
  if (entry === null || exit === null) return 0;
  const nightStart = timeToMinutes(rules.hora_inicio_nocturna);
  const nightEnd = timeToMinutes(rules.hora_fin_nocturna);
  let minutes = overlapMinutes(entry, exit, nightStart, nightEnd);
  const lunchStart = timeToMinutes(lunchOut);
  const lunchEnd = timeToMinutes(lunchIn);
  if (lunchStart !== null && lunchEnd !== null) {
    minutes -= Math.min(minutes, overlapMinutes(lunchStart, lunchEnd, nightStart, nightEnd));
  }
  return Math.max(0, minutes);
}

function roundMinutes(minutes, rules) {
  const step = Number(rules.redondeo_minutos || 1);
  if (step <= 1) return minutes;
  return Math.round(minutes / step) * step;
}

function isProfessionalServices(tipoContrato) {
  const normalized = String(tipoContrato || '').trim().toLowerCase();
  return PROFESSIONAL_SERVICE_TYPES.includes(normalized);
}

function isPaidAbsence(requestType, rules) {
  if (requestType === 'vacaciones') return true;
  if (requestType === 'permiso') return rules.ausencia_permiso_pagado;
  if (requestType === 'incapacidad') return rules.ausencia_incapacidad_pagada;
  return false;
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

async function getReglasLaborales(empresaId) {
  const result = await pool.query('SELECT * FROM reglas_laborales_empresa WHERE empresa_id = $1 LIMIT 1', [empresaId]);
  if (result.rows[0]) return normalizeRules(result.rows[0]);
  return normalizeRules({ empresa_id: empresaId });
}

async function updateReglasLaborales(empresaId, payload) {
  const current = await getReglasLaborales(empresaId);
  const rules = normalizeRules({ ...current, ...payload });
  const result = await pool.query(
    `INSERT INTO reglas_laborales_empresa (
       empresa_id, jornada_diaria_minutos, jornada_semanal_minutos, base_calculo_mensual_horas,
       dias_base_mes, tolerancia_atraso_minutos, almuerzo_minutos, almuerzo_inicio, almuerzo_fin,
       descontar_almuerzo_automatico, hora_inicio_nocturna, hora_fin_nocturna, recargo_suplementaria,
       recargo_extraordinaria, recargo_nocturna, recargo_feriado, redondeo_minutos,
       ausencia_permiso_pagado, ausencia_incapacidad_pagada, activo, actualizado_en
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::time,$9::time,$10,$11::time,$12::time,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
     ON CONFLICT (empresa_id) DO UPDATE SET
       jornada_diaria_minutos = EXCLUDED.jornada_diaria_minutos,
       jornada_semanal_minutos = EXCLUDED.jornada_semanal_minutos,
       base_calculo_mensual_horas = EXCLUDED.base_calculo_mensual_horas,
       dias_base_mes = EXCLUDED.dias_base_mes,
       tolerancia_atraso_minutos = EXCLUDED.tolerancia_atraso_minutos,
       almuerzo_minutos = EXCLUDED.almuerzo_minutos,
       almuerzo_inicio = EXCLUDED.almuerzo_inicio,
       almuerzo_fin = EXCLUDED.almuerzo_fin,
       descontar_almuerzo_automatico = EXCLUDED.descontar_almuerzo_automatico,
       hora_inicio_nocturna = EXCLUDED.hora_inicio_nocturna,
       hora_fin_nocturna = EXCLUDED.hora_fin_nocturna,
       recargo_suplementaria = EXCLUDED.recargo_suplementaria,
       recargo_extraordinaria = EXCLUDED.recargo_extraordinaria,
       recargo_nocturna = EXCLUDED.recargo_nocturna,
       recargo_feriado = EXCLUDED.recargo_feriado,
       redondeo_minutos = EXCLUDED.redondeo_minutos,
       ausencia_permiso_pagado = EXCLUDED.ausencia_permiso_pagado,
       ausencia_incapacidad_pagada = EXCLUDED.ausencia_incapacidad_pagada,
       activo = EXCLUDED.activo,
       actualizado_en = NOW()
     RETURNING *`,
    [
      empresaId,
      rules.jornada_diaria_minutos,
      rules.jornada_semanal_minutos,
      rules.base_calculo_mensual_horas,
      rules.dias_base_mes,
      rules.tolerancia_atraso_minutos,
      rules.almuerzo_minutos,
      rules.almuerzo_inicio,
      rules.almuerzo_fin,
      rules.descontar_almuerzo_automatico,
      rules.hora_inicio_nocturna,
      rules.hora_fin_nocturna,
      rules.recargo_suplementaria,
      rules.recargo_extraordinaria,
      rules.recargo_nocturna,
      rules.recargo_feriado,
      rules.redondeo_minutos,
      rules.ausencia_permiso_pagado,
      rules.ausencia_incapacidad_pagada,
      rules.activo,
    ],
  );
  return normalizeRules(result.rows[0]);
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
  const rules = await getReglasLaborales(empresaId);
  const employeeIds = [...new Set(detalle.map((d) => d.empleado_id))];
  if (!employeeIds.length) return [];

  const employeesResult = await pool.query(
    `SELECT id, salario_base, tipo_contrato FROM empleados WHERE id = ANY($1)`,
    [employeeIds],
  );
  const employees = new Map(employeesResult.rows.map((row) => [row.id, row]));
  return calcularResumenFinanciero(employeesResult.rows, detalle, rules).filter((row) => !isProfessionalServices(employees.get(row.empleado_id)?.tipo_contrato));
}

function calcularResumenFinanciero(employees, items, rules) {
  const grouped = new Map();
  for (const employee of employees) {
    grouped.set(employee.id, {
      empleado_id: employee.id,
      empleado_codigo: employee.codigo,
      empleado_nombre: `${employee.nombres || ''} ${employee.apellidos || ''}`.trim(),
      salario_base: Number(employee.salario_base || 0),
      tipo_contrato: employee.tipo_contrato || null,
      ausencias: 0,
      ausencias_justificadas: 0,
      ausencias_no_justificadas: 0,
      dias_pagados: 0,
      dias_no_pagados: 0,
      minutos_atraso: 0,
      minutos_extra: 0,
      minutos_suplementarias: 0,
      minutos_extraordinarias: 0,
      minutos_nocturnos: 0,
      minutos_feriado: 0,
      minutos_trabajados: 0,
    });
  }

  for (const item of items) {
    if (!grouped.has(item.empleado_id)) continue;
    const row = grouped.get(item.empleado_id);
    if (item.estado === 'ausente') {
      row.ausencias += 1;
      row.ausencias_no_justificadas += 1;
      row.dias_no_pagados += 1;
    }
    if (item.estado === 'justificada') {
      row.ausencias_justificadas += 1;
      if (item.ausencia_pagada) row.dias_pagados += 1;
      else row.dias_no_pagados += 1;
    }
    row.minutos_atraso += item.minutos_atraso || 0;
    row.minutos_extra += item.minutos_extra || 0;
    row.minutos_suplementarias += item.minutos_suplementarias || 0;
    row.minutos_extraordinarias += item.minutos_extraordinarias || 0;
    row.minutos_nocturnos += item.minutos_nocturnos || 0;
    row.minutos_feriado += item.minutos_feriado || 0;
    row.minutos_trabajados += item.minutos_trabajados || 0;
  }

  return [...grouped.values()].map((row) => {
    let descuentoAusencias = 0;
    let descuentoAtrasos = 0;
    let pagoSuplementarias = 0;
    let pagoExtraordinarias = 0;
    let pagoNocturnas = 0;
    let pagoFeriados = 0;
    let netoPagar = 0;
    const valorHora = row.salario_base > 0 ? row.salario_base / rules.base_calculo_mensual_horas : 0;
    const valorMinuto = valorHora / 60;

    if (row.salario_base > 0) {
      descuentoAusencias = row.dias_no_pagados * (row.salario_base / rules.dias_base_mes);
      descuentoAtrasos = row.minutos_atraso * valorMinuto;
      pagoSuplementarias = (row.minutos_suplementarias / 60) * valorHora * rules.recargo_suplementaria;
      pagoExtraordinarias = (row.minutos_extraordinarias / 60) * valorHora * rules.recargo_extraordinaria;
      pagoNocturnas = (row.minutos_nocturnos / 60) * valorHora * Math.max(0, rules.recargo_nocturna - 1);
      pagoFeriados = (row.minutos_feriado / 60) * valorHora * rules.recargo_feriado;
      netoPagar = Math.max(0, row.salario_base - descuentoAusencias - descuentoAtrasos + pagoSuplementarias + pagoExtraordinarias + pagoNocturnas + pagoFeriados);
    }

    const totalIngresos = row.salario_base + pagoSuplementarias + pagoExtraordinarias + pagoNocturnas + pagoFeriados;
    const totalDescuentos = descuentoAusencias + descuentoAtrasos;
    return {
      ...row,
      valor_hora: Number(valorHora.toFixed(4)),
      descuento_ausencias: Number(descuentoAusencias.toFixed(2)),
      descuento_atrasos: Number(descuentoAtrasos.toFixed(2)),
      pago_suplementarias: Number(pagoSuplementarias.toFixed(2)),
      pago_extraordinarias: Number(pagoExtraordinarias.toFixed(2)),
      pago_nocturnas: Number(pagoNocturnas.toFixed(2)),
      pago_feriados: Number(pagoFeriados.toFixed(2)),
      pago_horas_extra: Number((pagoSuplementarias + pagoExtraordinarias).toFixed(2)),
      total_ingresos: Number(totalIngresos.toFixed(2)),
      total_descuentos: Number(totalDescuentos.toFixed(2)),
      neto_pagar: Number(netoPagar.toFixed(2)),
    };
  });
}

function buildAlertasPrecierre({ items, prenomina, serviciosProfesionales }) {
  const alertas = [];
  const push = (nivel, codigo, mensaje, meta = {}) => alertas.push({ nivel, codigo, mensaje, ...meta });

  for (const item of items) {
    if (item.estado === 'incompleta') {
      push('critica', 'marcacion_incompleta', `${item.empleado_codigo} - ${item.empleado_nombre} tiene marcacion incompleta el ${item.fecha}.`, {
        empleado_id: item.empleado_id,
        fecha: item.fecha,
      });
    }
    if (item.estado === 'ausente') {
      push('advertencia', 'ausencia_no_justificada', `${item.empleado_codigo} - ${item.empleado_nombre} figura ausente sin justificacion el ${item.fecha}.`, {
        empleado_id: item.empleado_id,
        fecha: item.fecha,
      });
    }
    if (item.estado === 'sin_horario') {
      push('advertencia', 'marca_sin_horario', `${item.empleado_codigo} - ${item.empleado_nombre} marco el ${item.fecha} sin horario asignado.`, {
        empleado_id: item.empleado_id,
        fecha: item.fecha,
      });
    }
    if ((item.salida_almuerzo && !item.entrada_almuerzo) || (!item.salida_almuerzo && item.entrada_almuerzo)) {
      push('advertencia', 'almuerzo_incompleto', `${item.empleado_codigo} - ${item.empleado_nombre} tiene almuerzo incompleto el ${item.fecha}.`, {
        empleado_id: item.empleado_id,
        fecha: item.fecha,
      });
    }
    if (item.estado === 'justificada' && !item.ausencia_pagada) {
      push('info', 'ausencia_justificada_no_pagada', `${item.empleado_codigo} - ${item.empleado_nombre} tiene ausencia justificada no pagada el ${item.fecha}.`, {
        empleado_id: item.empleado_id,
        fecha: item.fecha,
      });
    }
  }

  for (const row of prenomina) {
    if (!row.salario_base) {
      push('critica', 'salario_base_faltante', `${row.empleado_codigo} - ${row.empleado_nombre} no tiene salario base para el resumen financiero.`, {
        empleado_id: row.empleado_id,
      });
    }
  }

  if (serviciosProfesionales.length) {
    push('info', 'servicios_profesionales_excluidos', `${serviciosProfesionales.length} persona(s) bajo factura quedan fuera del resumen financiero laboral.`, {
      total: serviciosProfesionales.length,
    });
  }

  return alertas;
}

async function calcularMes({ empresaId, mes }) {
  const range = monthRange(mes);
  const today = localToday();
  const maximumDate = mes > today.slice(0, 7) ? `${mes}-00` : mes === today.slice(0, 7) ? today : range.last;
  const rules = await getReglasLaborales(empresaId);
  const [employeesResult, schedulesResult, marksResult, requestsResult, feriadosResult] = await Promise.all([
    pool.query(
      `SELECT id, codigo, nombres, apellidos, sucursal_habitual_id, salario_base, tipo_contrato FROM empleados WHERE empresa_id = $1 AND estado = 'activo' ORDER BY codigo`,
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
              MIN(TO_CHAR(m.marcado_en AT TIME ZONE $4, 'HH24:MI:SS')) FILTER (WHERE m.tipo = 'salida_almuerzo') AS salida_almuerzo,
              MAX(TO_CHAR(m.marcado_en AT TIME ZONE $4, 'HH24:MI:SS')) FILTER (WHERE m.tipo = 'entrada_almuerzo') AS entrada_almuerzo,
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
    pool.query(
      `SELECT fecha::text FROM feriados WHERE empresa_id = $1 AND fecha BETWEEN $2::date AND $3::date`,
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
  const feriadosSet = new Set(feriadosResult.rows.map((row) => row.fecha));

  const items = [];
  for (const employee of employeesResult.rows) {
    for (const date of monthDates(range, maximumDate)) {
      const schedule = (schedulesByEmployee.get(employee.id) || []).find((item) =>
        item.fecha_inicio <= date.value && (!item.fecha_fin || item.fecha_fin >= date.value) && item.dias_semana.includes(date.weekday));
      const mark = marks.get(`${employee.id}:${date.value}`);
      const request = (requestsByEmployee.get(employee.id) || []).find((item) => item.fecha_inicio <= date.value && item.fecha_fin >= date.value);
      if (!schedule && !mark && !request) continue;

      const isFeriado = feriadosSet.has(date.value);
      const isWeekend = date.weekday === 6 || date.weekday === 7;
      const ausenciaPagada = request ? isPaidAbsence(request.tipo, rules) : false;
      const status = isFeriado ? 'feriado' : request ? 'justificada' : !schedule ? 'sin_horario' : !mark ? 'ausente' : !mark.entrada || !mark.salida ? 'incompleta' : 'completa';

      const scheduledStart = timeToMinutes(schedule?.hora_inicio);
      const scheduledEnd = timeToMinutes(schedule?.hora_fin);
      const scheduledBreakMinutes = lunchBreakMinutes(scheduledStart, scheduledEnd, schedule?.descanso_minutos, rules);
      const scheduledMinutes = Math.max(0, durationMinutes(scheduledStart, scheduledEnd) - scheduledBreakMinutes);
      const entry = timeToMinutes(mark?.entrada);
      const exit = timeToMinutes(mark?.salida);
      const explicitBreak = explicitLunchBreakMinutes(mark?.salida_almuerzo, mark?.entrada_almuerzo);
      const workedBreakMinutes = explicitBreak !== null ? explicitBreak : lunchBreakMinutes(entry, exit, schedule?.descanso_minutos, rules);
      const workedMinutes = roundMinutes(entry !== null && exit !== null ? Math.max(0, durationMinutes(entry, exit) - workedBreakMinutes) : 0, rules);
      const minutosNocturnos = roundMinutes(nightMinutes(entry, exit, mark?.salida_almuerzo, mark?.entrada_almuerzo, rules), rules);
      const minutosFeriado = isFeriado ? workedMinutes : 0;
      const tolerance = Math.max(Number(schedule?.tolerancia_minutos || 0), rules.tolerancia_atraso_minutos);
      const lateMinutes = entry !== null && scheduledStart !== null && !request && !isFeriado
        ? Math.max(0, entry - scheduledStart - tolerance)
        : 0;

      let minutosSuplementarias = 0;
      let minutosExtraordinarias = 0;
      const extraMins = scheduledMinutes ? Math.max(0, workedMinutes - scheduledMinutes) : 0;

      if (extraMins > 0) {
        if (isFeriado || isWeekend) minutosExtraordinarias = extraMins;
        else minutosSuplementarias = extraMins;
      } else if (!schedule && workedMinutes > 0) {
        if (isFeriado || isWeekend) minutosExtraordinarias = workedMinutes;
        else minutosSuplementarias = workedMinutes;
      }

      const ausenciaJustificadaMinutos = status === 'justificada' ? scheduledMinutes : 0;
      const ausenciaNoJustificadaMinutos = status === 'ausente' ? scheduledMinutes : 0;

      items.push({
        fecha: date.value,
        empleado_id: employee.id,
        empleado_codigo: employee.codigo,
        empleado_nombre: `${employee.nombres} ${employee.apellidos || ''}`.trim(),
        tipo_contrato: employee.tipo_contrato || null,
        bajo_factura: isProfessionalServices(employee.tipo_contrato),
        horario: schedule?.horario_nombre || null,
        entrada: mark?.entrada || null,
        salida_almuerzo: mark?.salida_almuerzo || null,
        entrada_almuerzo: mark?.entrada_almuerzo || null,
        salida: mark?.salida || null,
        minutos_programados: scheduledMinutes,
        minutos_trabajados: workedMinutes,
        minutos_ordinarios: Math.min(workedMinutes, scheduledMinutes || workedMinutes),
        minutos_extra: minutosSuplementarias + minutosExtraordinarias,
        minutos_suplementarias: minutosSuplementarias,
        minutos_extraordinarias: minutosExtraordinarias,
        minutos_nocturnos: minutosNocturnos,
        minutos_feriado: minutosFeriado,
        minutos_ausencia_justificada: ausenciaJustificadaMinutos,
        minutos_ausencia_no_justificada: ausenciaNoJustificadaMinutos,
        ausencia_pagada: ausenciaPagada,
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
    acc.minutos_suplementarias += item.minutos_suplementarias || 0;
    acc.minutos_extraordinarias += item.minutos_extraordinarias || 0;
    acc.minutos_nocturnos += item.minutos_nocturnos || 0;
    acc.minutos_feriado += item.minutos_feriado || 0;
    acc.minutos_ausencia_justificada += item.minutos_ausencia_justificada || 0;
    acc.minutos_ausencia_no_justificada += item.minutos_ausencia_no_justificada || 0;
    acc.minutos_atraso += item.minutos_atraso;
    acc.jornadas_completas += item.estado === 'completa' ? 1 : 0;
    acc.jornadas_incompletas += item.estado === 'incompleta' ? 1 : 0;
    acc.ausencias += item.estado === 'ausente' ? 1 : 0;
    acc.ausencias_justificadas += item.estado === 'justificada' ? 1 : 0;
    acc.ausencias_no_justificadas += item.estado === 'ausente' ? 1 : 0;
    acc.feriados += item.estado === 'feriado' ? 1 : 0;
    return acc;
  }, {
    empleados: employeesResult.rows.length,
    minutos_programados: 0,
    minutos_trabajados: 0,
    minutos_ordinarios: 0,
    minutos_extra: 0,
    minutos_suplementarias: 0,
    minutos_extraordinarias: 0,
    minutos_nocturnos: 0,
    minutos_feriado: 0,
    minutos_ausencia_justificada: 0,
    minutos_ausencia_no_justificada: 0,
    minutos_atraso: 0,
    jornadas_completas: 0,
    jornadas_incompletas: 0,
    ausencias: 0,
    ausencias_justificadas: 0,
    ausencias_no_justificadas: 0,
    feriados: 0,
  });

  const allFinancialRows = calcularResumenFinanciero(employeesResult.rows, items, rules);
  const prenomina = allFinancialRows.filter((row) => !isProfessionalServices(row.tipo_contrato));
  const serviciosProfesionales = allFinancialRows.filter((row) => isProfessionalServices(row.tipo_contrato)).map((row) => ({
    empleado_id: row.empleado_id,
    empleado_codigo: row.empleado_codigo,
    empleado_nombre: row.empleado_nombre,
    tipo_contrato: row.tipo_contrato,
    jornadas: items.filter((item) => item.empleado_id === row.empleado_id).length,
    minutos_trabajados: row.minutos_trabajados,
    minutos_atraso: row.minutos_atraso,
  }));
  const alertas = buildAlertasPrecierre({ items, prenomina, serviciosProfesionales });

  return {
    mes,
    reglas: rules,
    resumen: {
      ...resumen,
      servicios_profesionales: serviciosProfesionales.length,
      alertas_criticas: alertas.filter((alerta) => alerta.nivel === 'critica').length,
      alertas_advertencia: alertas.filter((alerta) => alerta.nivel === 'advertencia').length,
      alertas_info: alertas.filter((alerta) => alerta.nivel === 'info').length,
    },
    items,
    prenomina,
    servicios_profesionales: serviciosProfesionales,
    alertas,
  };
}

async function getCalculo({ empresaId, mes }) {
  const closure = await pool.query(`SELECT * FROM cierres_mensuales WHERE empresa_id = $1 AND mes = $2 LIMIT 1`, [empresaId, mes]);
  const rules = await getReglasLaborales(empresaId);
  if (closure.rows[0]?.estado === 'cerrado') {
    const resumen = closure.rows[0].resumen || {};
    const prenomina = resumen.prenomina || await calcularPrenominaDesdeDetalle(empresaId, closure.rows[0].detalle);
    return {
      mes,
      reglas: resumen.reglas || rules,
      resumen,
      items: closure.rows[0].detalle,
      prenomina,
      servicios_profesionales: resumen.servicios_profesionales_detalle || [],
      alertas: resumen.alertas || [],
      cierre: closure.rows[0],
    };
  }
  const calculation = await calcularMes({ empresaId, mes });
  return { ...calculation, cierre: closure.rows[0] || null };
}

async function getAlertas({ empresaId, mes }) {
  const calculation = await getCalculo({ empresaId, mes });
  return calculation.alertas || [];
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
    reglas: calculation.reglas,
    prenomina: calculation.prenomina,
    servicios_profesionales_detalle: calculation.servicios_profesionales,
    alertas: calculation.alertas,
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

module.exports = {
  assertPeriodoAbierto,
  calcularMes,
  cerrarMes,
  getAlertas,
  getCalculo,
  getReglasLaborales,
  listCierres,
  reabrirMes,
  updateReglasLaborales,
};
