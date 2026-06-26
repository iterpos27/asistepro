const crypto = require('crypto');
const { pool } = require('../config/database');
const laboralService = require('./laboral.service');
const vacacionesService = require('./vacaciones.service');
const { putObject } = require('./storage.service');

function getComprobanteBase64(comprobante) {
  const rawBase64 = String(comprobante.data_base64 || comprobante.data || '');
  return rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
}

function normalizeComprobante(comprobante) {
  if (!comprobante) return null;
  const base64 = getComprobanteBase64(comprobante);
  return {
    nombre: String(comprobante.nombre || comprobante.name || '').trim().slice(0, 255),
    tipo: String(comprobante.tipo || comprobante.type || 'application/octet-stream').trim(),
    data: Buffer.from(base64, 'base64'),
  };
}

function buildStorageKey({ empresaId, scope, entityId, fileName }) {
  return `tenants/${empresaId}/${scope}/${entityId}/${Date.now()}-${String(fileName || 'archivo').replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
}

async function uploadStoredFile({ empresaId, scope, entityId, file }) {
  if (!file?.data?.length) {
    return { provider: null, bucket: null, key: null, url: null };
  }
  const stored = await putObject({
    key: buildStorageKey({ empresaId, scope, entityId, fileName: file.nombre }),
    body: file.data,
    contentType: file.tipo,
  });
  return {
    provider: stored.provider,
    bucket: stored.bucket,
    key: stored.key,
    url: stored.url,
  };
}

async function resolveEmpleado(client, empresaId, auth, requestedId) {
  const values = [empresaId];
  let condition;
  if (auth.rol === 'EMPLEADO') { values.push(auth.usuario_id); condition = 'usuario_id = $2'; }
  else { if (!requestedId) { const error = new Error('empleado_id es requerido'); error.statusCode = 400; throw error; } values.push(requestedId); condition = 'id = $2'; }
  const result = await client.query(`SELECT * FROM empleados WHERE empresa_id = $1 AND ${condition} AND estado = 'activo' LIMIT 1`, values);
  if (!result.rows[0]) { const error = new Error('Empleado activo no encontrado'); error.statusCode = 404; throw error; }
  return result.rows[0];
}

async function createSolicitud({ empresaId, auth, payload }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const employee = await resolveEmpleado(client, empresaId, auth, payload.empleado_id);
    const overlap = await client.query(
      `SELECT id FROM solicitudes WHERE empresa_id = $1 AND empleado_id = $2 AND estado IN ('pendiente', 'aprobada')
       AND tipo <> 'correccion_marcacion' AND $3 <> 'correccion_marcacion'
       AND fecha_inicio <= $5::date AND fecha_fin >= $4::date LIMIT 1`,
      [empresaId, employee.id, payload.tipo, payload.fecha_inicio, payload.fecha_fin]);
    if (overlap.rows.length) { const error = new Error('Ya existe una solicitud activa que se cruza con esas fechas'); error.statusCode = 409; throw error; }
    
    const solicitudId = crypto.randomUUID();

    let fileData = { provider: null, bucket: null, key: null, url: null };
    if (payload.comprobante) {
      const normalizedFile = normalizeComprobante(payload.comprobante);
      fileData = await uploadStoredFile({
        empresaId,
        scope: 'solicitudes',
        entityId: solicitudId,
        file: normalizedFile,
      });
    }

    const result = await client.query(
      `INSERT INTO solicitudes (
        id, empresa_id, empleado_id, solicitado_por, tipo, fecha_inicio, fecha_fin,
        hora_inicio, hora_fin, motivo, datos_correccion, datos_adicionales,
        comprobante_storage_provider, comprobante_storage_bucket, comprobante_storage_key, comprobante_storage_url
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16) RETURNING *`,
      [
        solicitudId,
        empresaId,
        employee.id,
        auth.usuario_id,
        payload.tipo,
        payload.fecha_inicio,
        payload.fecha_fin,
        payload.hora_inicio || null,
        payload.hora_fin || null,
        payload.motivo,
        payload.datos_correccion ? JSON.stringify(payload.datos_correccion) : null,
        payload.datos_adicionales ? JSON.stringify(payload.datos_adicionales) : '{}',
        fileData.provider,
        fileData.bucket,
        fileData.key,
        fileData.url
      ]
    );
    await client.query('COMMIT'); return result.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function listSolicitudes({ empresaId, auth, estado, tipo, empleadoId, limit, offset }) {
  const filters = ['s.empresa_id = $1']; const values = [empresaId];
  if (auth.rol === 'EMPLEADO') {
    const managerBranchesRes = await pool.query(
      `
        SELECT id FROM sucursales
        WHERE empresa_id = $1
          AND jefe_empleado_id = (
            SELECT id FROM empleados WHERE empresa_id = $1 AND usuario_id = $2 LIMIT 1
          )
      `,
      [empresaId, auth.usuario_id]
    );

    if (managerBranchesRes.rows.length > 0) {
      const branchIds = managerBranchesRes.rows.map(r => r.id);
      values.push(auth.usuario_id);
      const userIndex = values.length;
      values.push(branchIds);
      const branchesIndex = values.length;

      filters.push(`(e.usuario_id = $${userIndex} OR e.sucursal_habitual_id = ANY($${branchesIndex}))`);
    } else {
      values.push(auth.usuario_id);
      filters.push(`e.usuario_id = $${values.length}`);
    }
  }
  else if (empleadoId) { values.push(empleadoId); filters.push(`s.empleado_id = $${values.length}`); }
  if (estado) { values.push(estado); filters.push(`s.estado = $${values.length}`); }
  if (tipo) { values.push(tipo); filters.push(`s.tipo = $${values.length}`); }
  values.push(limit); const limitIndex = values.length; values.push(offset); const offsetIndex = values.length;
  const result = await pool.query(
    `SELECT s.*, e.codigo AS empleado_codigo, e.nombres AS empleado_nombres, e.apellidos AS empleado_apellidos,
            e.cargo AS empleado_cargo, e.departamento AS empleado_departamento, e.cedula AS empleado_cedula,
            suc.nombre AS empleado_sucursal,
            solicitante.nombre AS solicitante_nombre, revisor.nombre AS revisor_nombre,
            validador.nombre AS validador_nombre,
            reemplazo.nombres AS reemplazo_nombres, reemplazo.apellidos AS reemplazo_apellidos,
            COUNT(*) OVER() AS total
     FROM solicitudes s 
     INNER JOIN empleados e ON e.id = s.empleado_id 
     INNER JOIN usuarios solicitante ON solicitante.id = s.solicitado_por
     LEFT JOIN usuarios revisor ON revisor.id = s.revisado_por 
     LEFT JOIN usuarios validador ON validador.id = s.validado_por
     LEFT JOIN empleados reemplazo ON reemplazo.id = s.reemplazo_empleado_id
     LEFT JOIN sucursales suc ON suc.id = e.sucursal_habitual_id
     WHERE ${filters.join(' AND ')}
     ORDER BY s.creado_en DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, values);
  return { items: result.rows.map(({ total, ...row }) => row), total: Number(result.rows[0]?.total || 0), limit, offset };
}

async function getCatalogs({ empresaId, auth }) {
  const employeeFilter = auth.rol === 'EMPLEADO' ? 'AND e.usuario_id = $2' : '';
  const values = auth.rol === 'EMPLEADO' ? [empresaId, auth.usuario_id] : [empresaId];
  const [branches, employees, marks, currentEmployee] = await Promise.all([
    pool.query(`SELECT id,nombre,codigo FROM sucursales WHERE empresa_id=$1 AND estado='activa' ORDER BY nombre`, [empresaId]),
    pool.query(`SELECT e.id,e.codigo,e.nombres,e.apellidos,e.cedula,e.usuario_id FROM empleados e WHERE e.empresa_id=$1 AND e.estado='activo' ORDER BY e.codigo`, [empresaId]),
    pool.query(`SELECT m.id,m.empleado_id,m.tipo,m.marcado_en,m.sucursal_id,s.nombre AS sucursal_nombre FROM marcaciones m INNER JOIN empleados e ON e.id=m.empleado_id INNER JOIN sucursales s ON s.id=m.sucursal_id WHERE m.empresa_id=$1 AND m.anulada=FALSE ${employeeFilter} ORDER BY m.marcado_en DESC LIMIT 200`, values),
    auth.rol === 'EMPLEADO'
      ? pool.query(`
          SELECT e.id,e.codigo,e.nombres,e.apellidos,e.cedula,e.usuario_id,
                 (SELECT EXISTS(SELECT 1 FROM sucursales s WHERE s.empresa_id = e.empresa_id AND s.jefe_empleado_id = e.id)) AS es_jefe
          FROM empleados e 
          WHERE e.empresa_id=$1 AND e.usuario_id=$2 AND e.estado='activo' LIMIT 1`, [empresaId, auth.usuario_id])
      : Promise.resolve({ rows: [] })
  ]);
  return {
    sucursales: branches.rows,
    empleados: employees.rows,
    marcaciones: marks.rows,
    empleado_actual: currentEmployee.rows[0] || null
  };
}

async function applyCorrection(client, request) {
  const data = request.datos_correccion;
  if (data.accion === 'crear') {
    await laboralService.assertPeriodoAbierto(request.empresa_id, data.marcado_en, client);
    const branch = await client.query(`SELECT * FROM sucursales WHERE empresa_id=$1 AND id=$2 AND estado='activa'`, [request.empresa_id, data.sucursal_id]);
    if (!branch.rows[0]) { const error = new Error('Sucursal de correccion no encontrada'); error.statusCode = 404; throw error; }
    const duplicate = await client.query(`SELECT id FROM marcaciones WHERE empresa_id=$1 AND empleado_id=$2 AND tipo=$3 AND anulada=FALSE AND (marcado_en AT TIME ZONE 'America/Guayaquil')::date=($4::timestamptz AT TIME ZONE 'America/Guayaquil')::date LIMIT 1`, [request.empresa_id, request.empleado_id, data.tipo, data.marcado_en]);
    if (duplicate.rows.length) { const error = new Error('Ya existe una marcacion de ese tipo en la fecha propuesta'); error.statusCode = 409; throw error; }
    await client.query(`INSERT INTO marcaciones (empresa_id,empleado_id,sucursal_id,tipo,estado,latitud,longitud,distancia_metros,dentro_geocerca,motivo_novedad,detalle_novedad,mensaje,marcado_en,origen,corregida_solicitud_id) VALUES ($1,$2,$3,$4,'aceptada_con_novedad',$5,$6,0,TRUE,'Correccion aprobada',$7,'Marcacion creada por solicitud aprobada',$8,'correccion',$9)`, [request.empresa_id, request.empleado_id, data.sucursal_id, data.tipo, branch.rows[0].latitud, branch.rows[0].longitud, request.motivo, data.marcado_en, request.id]);
  } else {
    const result = await client.query(`SELECT * FROM marcaciones WHERE empresa_id=$1 AND empleado_id=$2 AND id=$3 FOR UPDATE`, [request.empresa_id, request.empleado_id, data.marcacion_id]);
    const mark = result.rows[0]; if (!mark) { const error = new Error('Marcacion a corregir no encontrada'); error.statusCode = 404; throw error; }
    await laboralService.assertPeriodoAbierto(request.empresa_id, mark.marcado_en, client);
    if (data.accion === 'anular') await client.query(`UPDATE marcaciones SET anulada=TRUE,origen='correccion',corregida_solicitud_id=$4,detalle_novedad=$5 WHERE empresa_id=$1 AND id=$2 AND empleado_id=$3`, [request.empresa_id, mark.id, request.empleado_id, request.id, request.motivo]);
    else {
      await laboralService.assertPeriodoAbierto(request.empresa_id, data.marcado_en, client);
      const branch = await client.query(`SELECT * FROM sucursales WHERE empresa_id=$1 AND id=$2 AND estado='activa'`, [request.empresa_id, data.sucursal_id]);
      if (!branch.rows[0]) { const error = new Error('Sucursal de correccion no encontrada'); error.statusCode = 404; throw error; }
      await client.query(`UPDATE marcaciones SET sucursal_id=$4,tipo=$5,marcado_en=$6,latitud=$7,longitud=$8,distancia_metros=0,dentro_geocerca=TRUE,estado='aceptada_con_novedad',motivo_novedad='Correccion aprobada',detalle_novedad=$9,origen='correccion',corregida_solicitud_id=$10 WHERE empresa_id=$1 AND id=$2 AND empleado_id=$3`, [request.empresa_id, mark.id, request.empleado_id, data.sucursal_id, data.tipo, data.marcado_en, branch.rows[0].latitud, branch.rows[0].longitud, request.motivo, request.id]);
    }
  }
}

async function reviewSolicitud({ empresaId, solicitudId, reviewerId, auth, decision, comentario, datos_adicionales, reemplazo_empleado_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT * FROM solicitudes WHERE empresa_id=$1 AND id=$2 FOR UPDATE`, [empresaId, solicitudId]);
    const request = result.rows[0]; if (!request) { const error = new Error('Solicitud no encontrada'); error.statusCode = 404; throw error; }
    
    if (request.estado !== 'pendiente' && request.estado !== 'validada') {
      const error = new Error('La solicitud ya fue procesada');
      error.statusCode = 409;
      throw error;
    }

    const isSupervisor = auth && auth.rol === 'EMPLEADO';
    let nextEstado;

    // Enforce Jefe de Almacén rule if reviewer has role EMPLEADO
    if (isSupervisor) {
      if (request.estado !== 'pendiente') {
        const error = new Error('Un supervisor solo puede validar solicitudes en estado pendiente');
        error.statusCode = 409;
        throw error;
      }

      // 1. Get reviewer's employee record
      const reviewerEmpRes = await client.query(
        'SELECT id FROM empleados WHERE empresa_id = $1 AND usuario_id = $2 LIMIT 1',
        [empresaId, auth.usuario_id]
      );
      if (!reviewerEmpRes.rows.length) {
        const error = new Error('No tiene permisos para aprobar esta solicitud (revisor no es empleado)');
        error.statusCode = 403;
        throw error;
      }
      const reviewerEmpId = reviewerEmpRes.rows[0].id;

      // 2. A jefe de almacén cannot validate their own requests
      if (reviewerEmpId === request.empleado_id) {
        const error = new Error('Un jefe de almacén no puede aprobar sus propias solicitudes');
        error.statusCode = 403;
        throw error;
      }

      // 3. Get applicant's sucursal_habitual_id
      const applicantEmpRes = await client.query(
        'SELECT sucursal_habitual_id FROM empleados WHERE id = $1 LIMIT 1',
        [request.empleado_id]
      );
      if (!applicantEmpRes.rows.length) {
        const error = new Error('Empleado solicitante no encontrado');
        error.statusCode = 404;
        throw error;
      }
      const applicantSucursalId = applicantEmpRes.rows[0].sucursal_habitual_id;
      if (!applicantSucursalId) {
        const error = new Error('El empleado solicitante no está asignado a ninguna sucursal');
        error.statusCode = 403;
        throw error;
      }

      // 4. Verify if the reviewer is the jefe of that sucursal
      const sucursalRes = await client.query(
        'SELECT jefe_empleado_id FROM sucursales WHERE id = $1 AND empresa_id = $2 LIMIT 1',
        [applicantSucursalId, empresaId]
      );
      if (!sucursalRes.rows.length || sucursalRes.rows[0].jefe_empleado_id !== reviewerEmpId) {
        const error = new Error('Solo el jefe de almacén asignado a la sucursal del empleado puede aprobar esta solicitud');
        error.statusCode = 403;
        throw error;
      }

      nextEstado = decision === 'aprobar' ? 'validada' : 'rechazada';
    } else {
      // HR / Admin
      const isVacOrPermit = request.tipo === 'vacaciones' || request.tipo === 'permiso';
      if (isVacOrPermit && decision === 'aprobar' && request.estado !== 'validada') {
        const error = new Error('La solicitud debe ser validada por un supervisor antes de su aprobación final');
        error.statusCode = 403;
        throw error;
      }
      nextEstado = decision === 'aprobar' ? 'aprobada' : 'rechazada';
    }

    if (decision === 'aprobar' && nextEstado === 'aprobada') {
      await laboralService.assertPeriodoAbierto(empresaId, request.fecha_inicio, client);
      await laboralService.assertPeriodoAbierto(empresaId, request.fecha_fin, client);
      if (request.tipo === 'correccion_marcacion') await applyCorrection(client, request);
    }

    const fields = ['actualizado_en = NOW()'];
    const params = [empresaId, solicitudId];
    
    const addParam = (fieldName, value) => {
      params.push(value);
      fields.push(`${fieldName} = $${params.length}`);
    };

    addParam('estado', nextEstado);

    if (isSupervisor) {
      addParam('validado_por', reviewerId);
      fields.push('validado_en = NOW()');
      addParam('comentario_validacion', comentario || null);
      if (reemplazo_empleado_id) {
        addParam('reemplazo_empleado_id', reemplazo_empleado_id);
      }
    } else {
      addParam('revisado_por', reviewerId);
      fields.push('revisado_en = NOW()');
      addParam('comentario_revision', comentario || null);
    }

    if (datos_adicionales) {
      params.push(JSON.stringify(datos_adicionales));
      fields.push(`datos_adicionales = COALESCE(datos_adicionales, '{}'::jsonb) || $${params.length}::jsonb`);
    }

    const query = `UPDATE solicitudes SET ${fields.join(', ')} WHERE empresa_id = $1 AND id = $2 RETURNING *`;
    const updated = await client.query(query, params);

    // If vacation is finally approved, update the vacation balance
    if (decision === 'aprobar' && nextEstado === 'aprobada' && request.tipo === 'vacaciones') {
      const mergedAdicionales = {
        ...(request.datos_adicionales || {}),
        ...(datos_adicionales || {}),
      };
      await vacacionesService.registrarVacacionesAprobadas(
        empresaId,
        request.empleado_id,
        request,
        mergedAdicionales,
        client
      );
    }
    await client.query('COMMIT'); return updated.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function cancelSolicitud({ empresaId, solicitudId, auth }) {
  const values = [empresaId, solicitudId]; let ownerFilter = '';
  if (auth.rol === 'EMPLEADO') { values.push(auth.usuario_id); ownerFilter = 'AND solicitado_por = $3'; }
  const result = await pool.query(`UPDATE solicitudes SET estado='cancelada',actualizado_en=NOW() WHERE empresa_id=$1 AND id=$2 AND estado='pendiente' ${ownerFilter} RETURNING *`, values);
  if (!result.rows[0]) { const error = new Error('Solicitud pendiente no encontrada'); error.statusCode = 404; throw error; }
  return result.rows[0];
}

module.exports = { cancelSolicitud, createSolicitud, getCatalogs, listSolicitudes, reviewSolicitud };
