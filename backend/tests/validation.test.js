const assert = require('node:assert/strict');
const test = require('node:test');

const { listMarcacionesSchema, marcacionSchema } = require('../src/validators/marcacion.validator');
const { asistenciaDiariaSchema, entradasSalidasSchema } = require('../src/validators/reporte.validator');
const { createReemplazoSchema } = require('../src/validators/reemplazo.validator');
const { createSucursalSchema } = require('../src/validators/sucursal.validator');

test('validaciones rechazan coordenadas vacias en sucursales y marcaciones', () => {
  const sucursalResult = createSucursalSchema.safeParse({
    body: {
      nombre: 'Matriz',
      codigo: 'MAT',
      latitud: '',
      longitud: '-78.467834',
      radio_metros: 100,
    },
    query: {},
    params: {},
  });

  const marcacionResult = marcacionSchema.safeParse({
    body: {
      qr_token: 'token',
      tipo: 'entrada',
      latitud: '-0.180653',
      longitud: '',
    },
    query: {},
    params: {},
  });

  assert.equal(sucursalResult.success, false);
  assert.equal(marcacionResult.success, false);
});

test('validaciones rechazan fechas imposibles y rangos invertidos en reportes', () => {
  const fechaInvalida = asistenciaDiariaSchema.safeParse({
    body: {},
    query: { fecha: '2026-02-31' },
    params: {},
  });

  const rangoInvertido = entradasSalidasSchema.safeParse({
    body: {},
    query: { fecha_desde: '2026-06-16', fecha_hasta: '2026-06-01' },
    params: {},
  });

  assert.equal(fechaInvalida.success, false);
  assert.equal(rangoInvertido.success, false);
});

test('validaciones aceptan filtros validos de marcaciones', () => {
  const result = listMarcacionesSchema.safeParse({
    body: {},
    query: {
      empleado_id: '11111111-1111-4111-8111-111111111111',
      sucursal_id: '22222222-2222-4222-8222-222222222222',
      estado: 'aceptada',
      fecha_desde: '2026-06-01',
      fecha_hasta: '2026-06-16',
      limit: '50',
      offset: '0',
    },
    params: {},
  });

  assert.equal(result.success, true);
  assert.equal(result.data.query.limit, 50);
  assert.equal(result.data.query.offset, 0);
});

test('validaciones de reemplazo rechazan rangos de fecha y hora incoherentes', () => {
  const result = createReemplazoSchema.safeParse({
    body: {
      empleado_id: '11111111-1111-4111-8111-111111111111',
      sucursal_id: '22222222-2222-4222-8222-222222222222',
      fecha_inicio: '2026-06-16',
      fecha_fin: '2026-06-15',
      hora_inicio: '18:00',
      hora_fin: '08:00',
      motivo: 'Reemplazo autorizado',
    },
    query: {},
    params: {},
  });

  assert.equal(result.success, false);
});

test('validaciones de reemplazo aceptan autorizacion vigente correcta', () => {
  const result = createReemplazoSchema.safeParse({
    body: {
      empleado_id: '11111111-1111-4111-8111-111111111111',
      sucursal_id: '22222222-2222-4222-8222-222222222222',
      fecha_inicio: '2026-06-16',
      fecha_fin: '2026-06-18',
      hora_inicio: '08:00',
      hora_fin: '17:00',
      motivo: 'Reemplazo por ausencia',
      observacion: '',
    },
    query: {},
    params: {},
  });

  assert.equal(result.success, true);
});
