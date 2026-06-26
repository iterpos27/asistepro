const path = require('path');
const { loadBackendEnv } = require('../utils/env.util');
loadBackendEnv();

const { pool } = require('../config/database');

async function run() {
  console.log('--- STARTING ESSART S.A. MOCK DATA SEEDING ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find Company
    const companyRes = await client.query("SELECT id FROM empresas WHERE UPPER(nombre) = 'ESSART S.A.' LIMIT 1");
    if (!companyRes.rows.length) {
      throw new Error("Empresa 'ESSART S.A.' no encontrada en la base de datos.");
    }
    const empresaId = companyRes.rows[0].id;
    console.log(`Encontrada Empresa: ESSART S.A. (${empresaId})`);

    // 2. Find Sucursales
    const sucursalesRes = await client.query("SELECT id, codigo, latitud, longitud FROM sucursales WHERE empresa_id = $1", [empresaId]);
    const sucursales = {};
    sucursalesRes.rows.forEach(s => {
      sucursales[s.codigo] = s;
    });
    console.log(`Sucursales encontradas: ${Object.keys(sucursales).join(', ')}`);

    // 3. Helper to ensure user and employee exist (Self-healing)
    const ensureEmployee = async (email, nombres, apellidos, code, roleCodigo, branchCodigo) => {
      let empRes = await client.query("SELECT id, usuario_id FROM empleados WHERE empresa_id = $1 AND email = $2 LIMIT 1", [empresaId, email]);
      if (empRes.rows.length) {
        return empRes.rows[0];
      }

      console.log(`Creando empleado/usuario faltante: ${email}`);
      const roleRes = await client.query("SELECT id FROM roles WHERE codigo = $1 LIMIT 1", [roleCodigo]);
      const rolId = roleRes.rows[0]?.id;

      const branchId = sucursales[branchCodigo]?.id || sucursales['MATRIZ']?.id;

      let userRes = await client.query("SELECT id FROM usuarios WHERE email = $1 LIMIT 1", [email]);
      let userId = userRes.rows[0]?.id;
      if (!userId) {
        const pwdHash = '$2b$10$yKzUYMQadMg1p1cxdg7s6uqd.E3Yo.KIHux69TpyIEs3bN.aNoSQu'; // Password123*
        const newUser = await client.query(
          `INSERT INTO usuarios (empresa_id, rol_id, nombre, apellido, email, password_hash, estado)
           VALUES ($1, $2, $3, $4, $5, $6, 'activo') RETURNING id`,
          [empresaId, rolId, nombres, apellidos, email, pwdHash]
        );
        userId = newUser.rows[0].id;
      }

      const newEmp = await client.query(
        `INSERT INTO empleados (empresa_id, usuario_id, sucursal_habitual_id, codigo, nombres, apellidos, email, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo') RETURNING id`,
        [empresaId, userId, branchId, code, nombres, apellidos, email]
      );
      return { id: newEmp.rows[0].id, usuario_id: userId };
    };

    // Ensure key employees exist
    await ensureEmployee('juan.duenas@essart.com.ec', 'Juan', 'Dueñas', 'JUAN_DUEÑAS', 'ADMIN_EMPRESA', 'MATRIZ');
    await ensureEmployee('gianella.herrera@essart.com.ec', 'Gianella', 'Herrera', 'GIANELLA_HERRERA', 'RRHH', 'MATRIZ');
    await ensureEmployee('alberto.chinga@essart.com.ec', 'Alberto', 'Chinga', 'ALBERTO_CHINGA', 'EMPLEADO', 'PORTOVIEJO02');
    await ensureEmployee('amin.alarcon@essart.com.ec', 'Amin', 'Alarcon', 'AMIN_ALARCON', 'EMPLEADO', 'MATRIZ');
    await ensureEmployee('ariel.valdiviezo@essart.com.ec', 'Ariel', 'Valdiviezo', 'ARIEL_VALDIVIEZO', 'EMPLEADO', 'PORTOVIEJO02');
    await ensureEmployee('ramiro.muentes@essart.com.ec', 'Ramiro', 'Muentes', 'RAMIRO_MUENTES', 'EMPLEADO', 'PORTOVIEJO01');
    await ensureEmployee('johan.garcia@essart.com.ec', 'Johan', 'Garcia', 'JOHAN_GARCIA', 'EMPLEADO', 'PORTOVIEJO03');
    await ensureEmployee('jonathan.roldan@essart.com.ec', 'Jonathan', 'Roldan', 'JONATHAN_ROLDAN', 'EMPLEADO', 'PORTOVIEJO03');

    // Reload all employees
    const employeesRes = await client.query(`
      SELECT e.id, e.nombres, e.apellidos, e.email, e.sucursal_habitual_id, u.id AS usuario_id 
      FROM empleados e 
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.empresa_id = $1
    `, [empresaId]);

    const employees = {};
    employeesRes.rows.forEach(e => {
      employees[e.email] = e;
    });

    const getEmpId = email => employees[email]?.id;
    const getUserId = email => employees[email]?.usuario_id;

    console.log(`Empleados listos: ${Object.keys(employees).length}`);

    // Helper to ensure organizational structure nodes exist
    const ensureStructure = async (tipo, codigo, nombre, descripcion, responsableEmail = null, parentCodigo = null) => {
      let responsableId = null;
      if (responsableEmail) {
        responsableId = getEmpId(responsableEmail);
      }

      let parentId = null;
      if (parentCodigo) {
        const parentRes = await client.query("SELECT id FROM estructuras_organizacionales WHERE empresa_id = $1 AND codigo = $2 LIMIT 1", [empresaId, parentCodigo]);
        parentId = parentRes.rows[0]?.id;
      }

      const existing = await client.query("SELECT id FROM estructuras_organizacionales WHERE empresa_id = $1 AND tipo = $2 AND codigo = $3 LIMIT 1", [empresaId, tipo, codigo]);
      if (existing.rows.length) {
        const structId = existing.rows[0].id;
        await client.query(`
          UPDATE estructuras_organizacionales 
          SET nombre = $1, descripcion = $2, responsable_empleado_id = $3, parent_id = $4, actualizado_en = NOW() 
          WHERE id = $5
        `, [nombre, descripcion, responsableId, parentId, structId]);
        return structId;
      }

      const result = await client.query(`
        INSERT INTO estructuras_organizacionales (empresa_id, tipo, codigo, nombre, descripcion, responsable_empleado_id, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [empresaId, tipo, codigo, nombre, descripcion, responsableId, parentId]);
      return result.rows[0].id;
    };

    console.log('Seeding structures in estructuras_organizacionales table...');
    // Create Departments
    const depContId = await ensureStructure('departamento', 'DEP-CONT', 'Contabilidad', 'Departamento de Contabilidad y Auditoría Financiera', 'juan.duenas@essart.com.ec');
    const depRrhhId = await ensureStructure('departamento', 'DEP-RRHH', 'Recursos Humanos', 'Departamento de Talento Humano y Gestión de Personal', 'gianella.herrera@essart.com.ec');
    const depBodId = await ensureStructure('departamento', 'DEP-BOD', 'Bodega y Almacén', 'Departamento de Logística y Control de Inventarios');

    // Create Positions (Cargos)
    const cargJContId = await ensureStructure('cargo', 'CARG-JCONT', 'Jefe de Contabilidad', 'Dirección del área contable y tributaria', 'juan.duenas@essart.com.ec', 'DEP-CONT');
    const cargErrhhId = await ensureStructure('cargo', 'CARG-ERRHH', 'Encargado de RRHH', 'Control de nómina, asistencia y personal', 'gianella.herrera@essart.com.ec', 'DEP-RRHH');
    const cargJalmId = await ensureStructure('cargo', 'CARG-JALM', 'Jefe de Almacén', 'Administración de bodega y despacho de inventario', null, 'DEP-BOD');
    const cargAalmId = await ensureStructure('cargo', 'CARG-AALM', 'Asistente de Almacén', 'Apoyo operativo en despacho y picking', null, 'DEP-BOD');
    const cargAsisId = await ensureStructure('cargo', 'CARG-ASIS', 'Asistente General', 'Tareas operativas generales');

    // Create Cost Centers
    const ccMatId = await ensureStructure('centro_costo', 'CC-MAT', 'Matriz', 'Centro de costo de la oficina matriz');
    const ccPv01Id = await ensureStructure('centro_costo', 'CC-PV01', 'Portoviejo 01', 'Centro de costo de la sucursal Portoviejo 01');
    const ccPv02Id = await ensureStructure('centro_costo', 'CC-PV02', 'Portoviejo 02', 'Centro de costo de la sucursal Portoviejo 02');
    const ccPv03Id = await ensureStructure('centro_costo', 'CC-PV03', 'Portoviejo 03', 'Centro de costo de la sucursal Portoviejo 03');
    const ccMan01Id = await ensureStructure('centro_costo', 'CC-MAN01', 'Manta 01', 'Centro de costo de la sucursal Manta 01');

    // 4. Update Cargos, Supervisors, Areas and Cost Centers on Employees
    console.log('Actualizando cargos, estructuras y supervisores en empleados...');

    const albertoId = getEmpId('alberto.chinga@essart.com.ec');
    const aminId = getEmpId('amin.alarcon@essart.com.ec');

    // Juan Dueñas - Jefe de contabilidad
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Jefe de contabilidad', area_estructura_id = $1, cargo_estructura_id = $2, centro_costo_estructura_id = $3 
      WHERE id = $4
    `, [depContId, cargJContId, ccMatId, getEmpId('juan.duenas@essart.com.ec')]);

    // Gianella Herrera - RRHH
    await client.query(`
      UPDATE empleados 
      SET cargo = 'RRHH', area_estructura_id = $1, cargo_estructura_id = $2, centro_costo_estructura_id = $3 
      WHERE id = $4
    `, [depRrhhId, cargErrhhId, ccMatId, getEmpId('gianella.herrera@essart.com.ec')]);

    // Alberto Chinga - Jefe de almacén (PORTOVIEJO02)
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Jefe de almacén', area_estructura_id = $1, cargo_estructura_id = $2, centro_costo_estructura_id = $3 
      WHERE id = $4
    `, [depBodId, cargJalmId, ccPv02Id, albertoId]);
    if (sucursales['PORTOVIEJO02']) {
      await client.query("UPDATE sucursales SET jefe_empleado_id = $1 WHERE id = $2", [albertoId, sucursales['PORTOVIEJO02'].id]);
    }

    // Amin Alarcon - Jefe de almacén (MATRIZ)
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Jefe de almacén', area_estructura_id = $1, cargo_estructura_id = $2, centro_costo_estructura_id = $3 
      WHERE id = $4
    `, [depBodId, cargJalmId, ccMatId, aminId]);
    if (sucursales['MATRIZ']) {
      await client.query("UPDATE sucursales SET jefe_empleado_id = $1 WHERE id = $2", [aminId, sucursales['MATRIZ'].id]);
    }

    // Ariel Valdiviezo -> supervisor = Alberto, cargo = Asistente de almacén, cc = Portoviejo 02
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Asistente de almacén', supervisor_empleado_id = $1, area_estructura_id = $2, cargo_estructura_id = $3, centro_costo_estructura_id = $4 
      WHERE id = $5
    `, [albertoId, depBodId, cargAalmId, ccPv02Id, getEmpId('ariel.valdiviezo@essart.com.ec')]);

    // Ramiro Muentes -> supervisor = Alberto, cargo = Asistente de almacén, cc = Portoviejo 01
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Asistente de almacén', supervisor_empleado_id = $1, area_estructura_id = $2, cargo_estructura_id = $3, centro_costo_estructura_id = $4 
      WHERE id = $5
    `, [albertoId, depBodId, cargAalmId, ccPv01Id, getEmpId('ramiro.muentes@essart.com.ec')]);

    // Johan Garcia -> supervisor = Amin, cargo = Asistente de almacén, cc = Portoviejo 03
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Asistente de almacén', supervisor_empleado_id = $1, area_estructura_id = $2, cargo_estructura_id = $3, centro_costo_estructura_id = $4 
      WHERE id = $5
    `, [aminId, depBodId, cargAalmId, ccPv03Id, getEmpId('johan.garcia@essart.com.ec')]);

    // Jonathan Roldan -> supervisor = Amin, cargo = Asistente de almacén, cc = Portoviejo 03
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Asistente de almacén', supervisor_empleado_id = $1, area_estructura_id = $2, cargo_estructura_id = $3, centro_costo_estructura_id = $4 
      WHERE id = $5
    `, [aminId, depBodId, cargAalmId, ccPv03Id, getEmpId('jonathan.roldan@essart.com.ec')]);

    // Set other employees default cargo, CC and department
    await client.query(`
      UPDATE empleados 
      SET cargo = 'Asistente', area_estructura_id = $1, cargo_estructura_id = $2, centro_costo_estructura_id = $3
      WHERE empresa_id = $4 AND area_estructura_id IS NULL
    `, [depBodId, cargAsisId, ccMatId, empresaId]);

    // 5. Create or Find Horario
    console.log('Configurando horario estándar...');
    let horarioId;
    const horarioRes = await client.query("SELECT id FROM horarios WHERE empresa_id = $1 AND nombre = 'Horario General Essart' LIMIT 1", [empresaId]);
    if (horarioRes.rows.length) {
      horarioId = horarioRes.rows[0].id;
      await client.query(`
        UPDATE horarios 
        SET hora_inicio = '08:00:00', hora_fin = '17:00:00', descanso_minutos = 60, tolerancia_minutos = 10, dias_semana = '{1,2,3,4,5}'::smallint[] 
        WHERE id = $1
      `, [horarioId]);
    } else {
      const newHorario = await client.query(`
        INSERT INTO horarios (empresa_id, nombre, descripcion, dias_semana, hora_inicio, hora_fin, descanso_minutos, tolerancia_minutos, activo)
        VALUES ($1, 'Horario General Essart', 'Horario de oficina y almacén Lun-Vie', '{1,2,3,4,5}'::smallint[], '08:00:00', '17:00:00', 60, 10, TRUE)
        RETURNING id
      `, [empresaId]);
      horarioId = newHorario.rows[0].id;
    }

    // Assign Horario to everyone
    console.log('Asignando horarios a todos los empleados...');
    await client.query("DELETE FROM empleado_horarios WHERE empresa_id = $1", [empresaId]);
    for (const emp of employeesRes.rows) {
      await client.query(`
        INSERT INTO empleado_horarios (empresa_id, empleado_id, horario_id, fecha_inicio, fecha_fin, activo)
        VALUES ($1, $2, $3, '2026-06-01', NULL, TRUE)
      `, [empresaId, emp.id, horarioId]);
    }

    // 6. Delete old mock data (marcaciones, solicitudes, feriados)
    console.log('Limpiando marcaciones, feriados y solicitudes previas...');
    const allEmpIds = employeesRes.rows.map(e => e.id);
    await client.query("DELETE FROM marcaciones WHERE empresa_id = $1 AND empleado_id = ANY($2)", [empresaId, allEmpIds]);
    await client.query("DELETE FROM solicitudes WHERE empresa_id = $1 AND empleado_id = ANY($2)", [empresaId, allEmpIds]);
    await client.query("DELETE FROM feriados WHERE empresa_id = $1", [empresaId]);

    // 7. Seed Feriado on June 23, 2026
    console.log('Registrando feriado local...');
    await client.query(`
      INSERT INTO feriados (empresa_id, nombre, fecha, descripcion, activo)
      VALUES ($1, 'Feriado de San Juan (Local)', '2026-06-23', 'Feriado local para descanso y festividades', TRUE)
    `, [empresaId]);

    // 8. Seed Solicitud for Ariel Valdiviezo on June 24, 2026
    console.log('Registrando solicitud de vacaciones para Ariel Valdiviezo...');
    const ariel = employees['ariel.valdiviezo@essart.com.ec'];
    await client.query(`
      INSERT INTO solicitudes (
        empresa_id, empleado_id, solicitado_por, tipo, fecha_inicio, fecha_fin, motivo, estado, revisado_por, revisado_en, comentario_revision
      ) VALUES ($1, $2, $3, 'vacaciones', '2026-06-24', '2026-06-24', 'Descanso anual por vacaciones', 'aprobada', $4, NOW(), 'Aprobada automáticamente por RRHH')
    `, [empresaId, ariel.id, ariel.usuario_id, getUserId('gianella.herrera@essart.com.ec')]);

    // 9. Simulate Marcaciones (June 22, 24, 25)
    console.log('Generando marcaciones simuladas...');

    const insertMarcacion = async (email, fecha, horaEntrada, horaSalida, entradaNovedad = null, salidaNovedad = null) => {
      const emp = employees[email];
      if (!emp) return;
      const sucId = emp.sucursal_habitual_id || sucursales['MATRIZ'].id;
      const lat = sucursales['MATRIZ'].latitud;
      const lon = sucursales['MATRIZ'].longitud;

      if (horaEntrada) {
        const entTime = `${fecha} ${horaEntrada}`;
        const entEstado = entradaNovedad ? 'aceptada_con_novedad' : 'aceptada';
        await client.query(`
          INSERT INTO marcaciones (empresa_id, empleado_id, sucursal_id, horario_id, tipo, estado, latitud, longitud, distancia_metros, dentro_geocerca, marcado_en, motivo_novedad, detalle_novedad, anulada)
          VALUES ($1, $2, $3, $4, 'entrada', $5, $6, $7, 0.00, TRUE, $8::timestamptz, $9, $10, FALSE)
        `, [
          empresaId,
          emp.id,
          sucId,
          horarioId,
          entEstado,
          lat,
          lon,
          entTime,
          entradaNovedad ? 'atraso' : null,
          entradaNovedad
        ]);
      }

      if (horaSalida) {
        const salTime = `${fecha} ${horaSalida}`;
        const salEstado = salidaNovedad ? 'aceptada_con_novedad' : 'aceptada';
        await client.query(`
          INSERT INTO marcaciones (empresa_id, empleado_id, sucursal_id, horario_id, tipo, estado, latitud, longitud, distancia_metros, dentro_geocerca, marcado_en, motivo_novedad, detalle_novedad, anulada)
          VALUES ($1, $2, $3, $4, 'salida', $5, $6, $7, 0.00, TRUE, $8::timestamptz, $9, $10, FALSE)
        `, [
          empresaId,
          emp.id,
          sucId,
          horarioId,
          salEstado,
          lat,
          lon,
          salTime,
          salidaNovedad ? 'salida_novedad' : null,
          salidaNovedad
        ]);
      }
    };

    // June 22, 2026 (Monday)
    await insertMarcacion('juan.duenas@essart.com.ec', '2026-06-22', '08:00:00', '17:00:00');
    await insertMarcacion('gianella.herrera@essart.com.ec', '2026-06-22', '08:00:00', '18:00:00');
    await insertMarcacion('alberto.chinga@essart.com.ec', '2026-06-22', '08:00:00', '16:00:00');
    await insertMarcacion('amin.alarcon@essart.com.ec', '2026-06-22', '08:00:00', '17:00:00');
    await insertMarcacion('ramiro.muentes@essart.com.ec', '2026-06-22', '07:55:00', '18:30:00');
    await insertMarcacion('ariel.valdiviezo@essart.com.ec', '2026-06-22', '08:15:00', '17:00:00', 'Llegada tarde a oficina');
    await insertMarcacion('johan.garcia@essart.com.ec', '2026-06-22', '08:00:00', '17:00:00');
    await insertMarcacion('jonathan.roldan@essart.com.ec', '2026-06-22', '08:00:00', '14:00:00');

    // June 24, 2026 (Wednesday)
    await insertMarcacion('juan.duenas@essart.com.ec', '2026-06-24', '08:00:00', '17:00:00');
    await insertMarcacion('gianella.herrera@essart.com.ec', '2026-06-24', '08:12:00', '18:30:00', 'Atraso menor en transporte');
    await insertMarcacion('alberto.chinga@essart.com.ec', '2026-06-24', '08:00:00', '15:30:00');
    await insertMarcacion('amin.alarcon@essart.com.ec', '2026-06-24', '08:00:00', '17:00:00');
    await insertMarcacion('ramiro.muentes@essart.com.ec', '2026-06-24', '07:58:00', '19:00:00');
    // Ariel Valdiviezo has APPROVED vacation on June 24 (no marcaciones)
    await insertMarcacion('johan.garcia@essart.com.ec', '2026-06-24', '08:00:00', '17:00:00');
    await insertMarcacion('jonathan.roldan@essart.com.ec', '2026-06-24', '08:00:00', '13:30:00');

    // June 25, 2026 (Thursday)
    await insertMarcacion('juan.duenas@essart.com.ec', '2026-06-25', '08:00:00', '17:00:00');
    await insertMarcacion('gianella.herrera@essart.com.ec', '2026-06-25', '08:00:00', '19:00:00');
    await insertMarcacion('alberto.chinga@essart.com.ec', '2026-06-25', '08:00:00', '16:30:00');
    await insertMarcacion('amin.alarcon@essart.com.ec', '2026-06-25', '08:00:00', '17:00:00');
    await insertMarcacion('ramiro.muentes@essart.com.ec', '2026-06-25', '07:57:00', '18:00:00');
    await insertMarcacion('ariel.valdiviezo@essart.com.ec', '2026-06-25', '08:00:00', '15:00:00');
    await insertMarcacion('johan.garcia@essart.com.ec', '2026-06-25', '08:00:00', '17:00:00');
    await insertMarcacion('jonathan.roldan@essart.com.ec', '2026-06-25', '08:00:00', '14:30:00');

    console.log('Marcaciones creadas exitosamente.');

    await client.query('COMMIT');
    console.log('--- MOCK DATA SEEDING COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
