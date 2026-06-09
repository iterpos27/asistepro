const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');
const empleadoService = require('../src/services/empleado.service');
const horarioService = require('../src/services/horario.service');

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
