const { pool } = require('../config/database');

/**
 * Vacation entitlement rules (Ecuador Labor Code):
 * - 15 days/year base for all employees
 * - After completing 5 years: +1 day per additional year (max 30 total)
 */
function calcularDiasDerechoAnual(fechaIngreso, anio) {
  if (!fechaIngreso) return 15;
  const ingreso = new Date(fechaIngreso);
  const anioRef = new Date(`${anio}-12-31`);
  if (ingreso > anioRef) return 0; // Not yet hired by end of year

  const aniosServicio = Math.floor(
    (anioRef - ingreso) / (365.25 * 24 * 60 * 60 * 1000)
  );

  if (aniosServicio < 1) return 0; // First year not completed
  if (aniosServicio < 5) return 15;
  const extra = Math.min(aniosServicio - 5, 15); // cap extra at 15 → max 30 total
  return 15 + extra;
}

/**
 * Get or create the vacation balance record for a given year.
 * Automatically calculates days_derecho from seniority.
 */
async function getOrCreateSaldo(empresaId, empleadoId, anio, client) {
  const db = client || pool;

  // Try to get existing record
  const existing = await db.query(
    `SELECT vs.*, e.fecha_ingreso FROM vacaciones_saldo vs
     INNER JOIN empleados e ON e.id = vs.empleado_id
     WHERE vs.empresa_id = $1 AND vs.empleado_id = $2 AND vs.anio = $3 LIMIT 1`,
    [empresaId, empleadoId, anio]
  );
  if (existing.rows[0]) return existing.rows[0];

  // Calculate entitlement from employee's hire date
  const empRes = await db.query(
    `SELECT fecha_ingreso FROM empleados WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, empleadoId]
  );
  const emp = empRes.rows[0];
  const diasDerecho = calcularDiasDerechoAnual(emp?.fecha_ingreso, anio);

  const created = await db.query(
    `INSERT INTO vacaciones_saldo (empresa_id, empleado_id, anio, dias_derecho, saldo_inicial, dias_tomados)
     VALUES ($1, $2, $3, $4, 0, 0)
     ON CONFLICT (empresa_id, empleado_id, anio) DO UPDATE
       SET dias_derecho = EXCLUDED.dias_derecho, actualizado_en = NOW()
     RETURNING *`,
    [empresaId, empleadoId, anio, diasDerecho]
  );
  return created.rows[0];
}

/**
 * Get full vacation info for one employee: current year + next year projection.
 */
async function getSaldoEmpleado(empresaId, empleadoId) {
  const anioActual = new Date().getFullYear();
  const anioSiguiente = anioActual + 1;

  const empRes = await pool.query(
    `SELECT id, codigo, nombres, apellidos, fecha_ingreso FROM empleados
     WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, empleadoId]
  );
  const emp = empRes.rows[0];
  if (!emp) {
    const error = new Error('Empleado no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const [saldoActual, saldoRes] = await Promise.all([
    getOrCreateSaldo(empresaId, empleadoId, anioActual),
    pool.query(
      `SELECT * FROM vacaciones_saldo WHERE empresa_id = $1 AND empleado_id = $2 ORDER BY anio DESC`,
      [empresaId, empleadoId]
    ),
  ]);

  const disponibles = Number(saldoActual.saldo_inicial) + Number(saldoActual.dias_derecho) - Number(saldoActual.dias_tomados);

  return {
    empleado: emp,
    anio_actual: anioActual,
    saldo_actual: {
      ...saldoActual,
      dias_disponibles: Math.max(0, disponibles),
    },
    proyeccion_proximo_anio: {
      anio: anioSiguiente,
      dias_derecho: calcularDiasDerechoAnual(emp.fecha_ingreso, anioSiguiente),
      saldo_a_favor: Math.max(0, disponibles), // current year leftover carries over
    },
    historial: saldoRes.rows.map((r) => ({
      ...r,
      dias_disponibles: Math.max(0, Number(r.saldo_inicial) + Number(r.dias_derecho) - Number(r.dias_tomados)),
    })),
  };
}

/**
 * List vacation balances for all employees of a company.
 */
async function listSaldos({ empresaId, anio, limit = 100, offset = 0 }) {
  const anioRef = anio ? parseInt(anio, 10) : new Date().getFullYear();

  // Ensure all active employees have a balance record for this year
  const activos = await pool.query(
    `SELECT id FROM empleados WHERE empresa_id = $1 AND estado = 'activo'`,
    [empresaId]
  );
  await Promise.all(
    activos.rows.map((e) => getOrCreateSaldo(empresaId, e.id, anioRef).catch(() => {}))
  );

  const result = await pool.query(
    `SELECT
       vs.*,
       e.codigo AS empleado_codigo,
       e.nombres AS empleado_nombres,
       e.apellidos AS empleado_apellidos,
       e.fecha_ingreso,
       e.cargo,
       COUNT(*) OVER() AS total,
       (vs.saldo_inicial + vs.dias_derecho - vs.dias_tomados) AS dias_disponibles
     FROM vacaciones_saldo vs
     INNER JOIN empleados e ON e.id = vs.empleado_id
     WHERE vs.empresa_id = $1 AND vs.anio = $2 AND e.estado = 'activo'
     ORDER BY e.codigo
     LIMIT $3 OFFSET $4`,
    [empresaId, anioRef, limit, offset]
  );

  return {
    items: result.rows.map(({ total, ...row }) => ({
      ...row,
      dias_disponibles: Math.max(0, Number(row.dias_disponibles)),
    })),
    total: Number(result.rows[0]?.total || 0),
    anio: anioRef,
    limit,
    offset,
  };
}

/**
 * Set the initial balance when registering an employee.
 * Called from empleado.service.js upon creation.
 */
async function setSaldoInicial(empresaId, empleadoId, saldoInicial, client) {
  const db = client || pool;
  const anio = new Date().getFullYear();
  const empRes = await db.query(
    `SELECT fecha_ingreso FROM empleados WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, empleadoId]
  );
  const diasDerecho = calcularDiasDerechoAnual(empRes.rows[0]?.fecha_ingreso, anio);

  await db.query(
    `INSERT INTO vacaciones_saldo (empresa_id, empleado_id, anio, dias_derecho, saldo_inicial, dias_tomados)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT (empresa_id, empleado_id, anio) DO UPDATE
       SET saldo_inicial = EXCLUDED.saldo_inicial,
           dias_derecho = EXCLUDED.dias_derecho,
           actualizado_en = NOW()`,
    [empresaId, empleadoId, anio, diasDerecho, saldoInicial]
  );
}

/**
 * When a vacation solicitud is approved, deduct days from the balance.
 * Also stores the HR-provided saldo data from datos_adicionales.
 */
async function registrarVacacionesAprobadas(empresaId, empleadoId, solicitud, datosAdicionales, client) {
  const db = client || pool;
  
  const formatFecha = (f) => {
    if (!f) return '';
    if (f instanceof Date) {
      const year = f.getFullYear();
      const month = String(f.getMonth() + 1).padStart(2, '0');
      const day = String(f.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof f === 'string') return f.split('T')[0];
    return String(f);
  };

  const strInicio = formatFecha(solicitud.fecha_inicio);
  const strFin = formatFecha(solicitud.fecha_fin);
  const anio = new Date(strInicio + 'T00:00:00').getFullYear();
  await getOrCreateSaldo(empresaId, empleadoId, anio, db);

  // Calculate days from the request
  const inicio = new Date(strInicio + 'T00:00:00');
  const fin = new Date(strFin + 'T00:00:00');
  const diffMs = Math.abs(fin - inicio);
  let diasTomados = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

  // Calculate fraction for hourly request
  if (solicitud.hora_inicio && solicitud.hora_fin) {
    const timeToMinutes = (val) => {
      if (!val) return null;
      const [h, m] = String(val).slice(0, 5).split(':').map(Number);
      return h * 60 + m;
    };
    const startMin = timeToMinutes(solicitud.hora_inicio);
    const endMin = timeToMinutes(solicitud.hora_fin);
    if (startMin !== null && endMin !== null) {
      const durationMin = endMin >= startMin ? endMin - startMin : endMin + 1440 - startMin;
      // Calculate fraction based on standard 8-hour workday (480 mins)
      const fraction = Number((durationMin / 480).toFixed(2));
      diasTomados = Math.min(1.00, fraction);
    }
  }

  // If HR provided saldo info, use that; otherwise auto-increment
  if (datosAdicionales?.saldo_anterior !== undefined && datosAdicionales?.saldo_actual !== undefined) {
    const diasOtorgados = datosAdicionales.dias_otorgados || diasTomados;
    const newTomados = Number(datosAdicionales.saldo_anterior) - Number(datosAdicionales.saldo_actual);
    await db.query(
      `UPDATE vacaciones_saldo
       SET dias_tomados = $4,
           saldo_inicial = $5,
           notas = COALESCE(notas, '') || $6,
           actualizado_en = NOW()
       WHERE empresa_id = $1 AND empleado_id = $2 AND anio = $3`,
      [
        empresaId,
        empleadoId,
        anio,
        Math.max(0, newTomados),
        Number(datosAdicionales.saldo_anterior),
        ` | Sol.${solicitud.id?.slice(0, 8)}: ${diasOtorgados} día(s)`,
      ]
    );
  } else {
    await db.query(
      `UPDATE vacaciones_saldo
       SET dias_tomados = dias_tomados + $4,
           actualizado_en = NOW()
       WHERE empresa_id = $1 AND empleado_id = $2 AND anio = $3`,
      [empresaId, empleadoId, anio, diasTomados]
    );
  }
}

/**
 * Manually adjust a balance (HR override).
 */
async function updateSaldo(empresaId, empleadoId, anio, payload, ajustadoPorId) {
  const existing = await getOrCreateSaldo(empresaId, empleadoId, anio);
  const updates = {};
  if (payload.saldo_inicial !== undefined) updates.saldo_inicial = Number(payload.saldo_inicial);
  if (payload.dias_derecho !== undefined) updates.dias_derecho = Number(payload.dias_derecho);
  if (payload.dias_tomados !== undefined) updates.dias_tomados = Number(payload.dias_tomados);
  if (payload.notas !== undefined) updates.notas = payload.notas;

  const fields = Object.keys(updates);
  if (!fields.length) return existing;

  const setClauses = fields.map((f, i) => `${f} = $${i + 4}`);
  const values = [empresaId, empleadoId, anio, ...fields.map((f) => updates[f])];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE vacaciones_saldo
       SET ${setClauses.join(', ')}, actualizado_en = NOW()
       WHERE empresa_id = $1 AND empleado_id = $2 AND anio = $3
       RETURNING *`,
      values
    );

    const updated = result.rows[0];

    // Audit the adjustment
    let actorId = ajustadoPorId;
    if (!actorId) {
      const userRes = await client.query('SELECT id FROM usuarios WHERE empresa_id = $1 LIMIT 1', [empresaId]);
      actorId = userRes.rows[0]?.id || null;
    }

    await client.query(
      `INSERT INTO vacaciones_ajustes (
        empresa_id, empleado_id, anio,
        saldo_inicial_anterior, saldo_inicial_nuevo,
        dias_derecho_anterior, dias_derecho_nuevo,
        dias_tomados_anterior, dias_tomados_nuevo,
        motivo, ajustado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        empresaId,
        empleadoId,
        anio,
        Number(existing.saldo_inicial || 0),
        Number(updated.saldo_inicial || 0),
        Number(existing.dias_derecho || 0),
        Number(updated.dias_derecho || 0),
        Number(existing.dias_tomados || 0),
        Number(updated.dias_tomados || 0),
        payload.motivo || 'Ajuste manual de vacaciones',
        actorId
      ]
    );

    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  calcularDiasDerechoAnual,
  getOrCreateSaldo,
  getSaldoEmpleado,
  listSaldos,
  setSaldoInicial,
  registrarVacacionesAprobadas,
  updateSaldo,
};
