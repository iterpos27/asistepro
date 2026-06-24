const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');
const empleadoService = require('../src/services/empleado.service');
const horarioService = require('../src/services/horario.service');
const marcacionService = require('../src/services/marcacion.service');
const tenantService = require('../src/services/tenant.service');

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

test('findEmpleadoById filtra siempre por empresa_id e id', async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [] };
  };

  const result = await empleadoService.findEmpleadoById('empresa-a', 'empleado-b');

  assert.equal(result, null);
  assert.match(calls[0].sql, /WHERE e\.empresa_id = \$1\s+AND e\.id = \$2/);
  assert.deepEqual(calls[0].values, ['empresa-a', 'empleado-b']);
});

test('listEmpleados conserva tenant como primer filtro aunque existan filtros adicionales', async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [] };
  };

  await empleadoService.listEmpleados({
    empresaId: 'empresa-a',
    search: 'ana',
    estado: 'activo',
    sucursalId: 'sucursal-x',
    limit: 25,
    offset: 5,
  });

  assert.match(calls[0].sql, /WHERE e\.empresa_id = \$1/);
  assert.equal(calls[0].values[0], 'empresa-a');
  assert.ok(calls[0].values.includes('activo'));
  assert.ok(calls[0].values.includes('sucursal-x'));
});

test('assignHorario rechaza empleado fuera del tenant antes de insertar', async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    if (/FROM empleados/.test(sql)) return { rows: [] };
    throw new Error('No debe consultar horario ni insertar si empleado no pertenece al tenant');
  };

  await assert.rejects(
    () =>
      horarioService.assignHorario('empresa-a', {
        empleado_id: 'empleado-externo',
        horario_id: 'horario-a',
      }),
    /empleado_id no pertenece a la empresa/,
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE empresa_id = \$1\s+AND id = \$2/);
  assert.deepEqual(calls[0].values, ['empresa-a', 'empleado-externo']);
});

test('assignHorario rechaza horario fuera del tenant antes de insertar', async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    if (/FROM empleados/.test(sql)) return { rows: [{ id: 'empleado-a' }] };
    if (/FROM horarios/.test(sql)) return { rows: [] };
    throw new Error('No debe insertar si horario no pertenece al tenant');
  };

  await assert.rejects(
    () =>
      horarioService.assignHorario('empresa-a', {
        empleado_id: 'empleado-a',
        horario_id: 'horario-externo',
      }),
    /horario_id no pertenece a la empresa/,
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].values, ['empresa-a', 'horario-externo']);
});

test('assertPlanCapacity bloquea creacion al exceder limite de empleados del plan', async () => {
  pool.query = async () => ({
    rows: [
      {
        empleados: 10,
        sucursales: 1,
      },
    ],
  });

  await assert.rejects(
    () =>
      tenantService.assertPlanCapacity({
        empresaId: 'empresa-a',
        plan: {
          limite_empleados: 10,
          limite_sucursales: 1,
        },
        includeNew: { empleados: 1 },
      }),
    /Límite de empleados alcanzado. Debe elegir un nuevo plan/,
  );
});

test('assertPlanCapacity permite planes sin limite explicito', async () => {
  pool.query = async () => ({
    rows: [
      {
        empleados: 500,
        sucursales: 80,
      },
    ],
  });

  await assert.doesNotReject(() =>
    tenantService.assertPlanCapacity({
      empresaId: 'empresa-enterprise',
      plan: {
        limite_empleados: null,
        limite_sucursales: null,
      },
      includeNew: { empleados: 1, sucursales: 1 },
    }),
  );
});

test('assertDailyTipoLimit bloquea segunda entrada valida del mismo dia', async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ id: 'marcacion-previa' }] };
  };

  await assert.rejects(
    () =>
      marcacionService.assertDailyTipoLimit({
        empresaId: 'empresa-a',
        empleadoId: 'empleado-a',
        tipo: 'entrada',
        markedAt: '2026-06-16T14:00:00Z',
      }),
    /Ya existe una marcacion de entrada/,
  );

  assert.match(calls[0].sql, /estado <> 'rechazada'/);
  assert.match(calls[0].sql, /marcado_en AT TIME ZONE \$5/);
  assert.deepEqual(calls[0].values, [
    'empresa-a',
    'empleado-a',
    'entrada',
    '2026-06-16T14:00:00Z',
    'America/Guayaquil',
  ]);
});

test('assertDailyTipoLimit permite salida si no hay salida valida del dia', async () => {
  pool.query = async () => ({ rows: [] });

  await assert.doesNotReject(() =>
    marcacionService.assertDailyTipoLimit({
      empresaId: 'empresa-a',
      empleadoId: 'empleado-a',
      tipo: 'salida',
      markedAt: '2026-06-16T22:00:00Z',
    }),
  );
});
