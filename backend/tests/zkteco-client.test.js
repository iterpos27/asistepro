const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assignAttendanceTypes,
  deviceDateToTimestamp,
  normalizeAttendanceRecords,
  normalizeDeviceConfig,
  readZktecoDevice,
} = require('../src/integrations/zkteco.client');

test('la recuperacion por usuario no cambia el corte de los otros usuarios', () => {
  const old = new Date(Date.now() - 40 * 86400000);
  const oldDate = deviceDateToTimestamp(old).slice(0, 10);
  const today = deviceDateToTimestamp(new Date()).slice(0, 10);
  const records = ['2', '52'].map(deviceUserId => ({ deviceUserId, recordTime: old }));
  const result = normalizeAttendanceRecords(records, { ip: '192.168.0.125', fecha_desde: today,
    usuarios_mapeo: { 2: 'AMIN', 52: 'NUEVO' }, usuarios_fecha_desde: { 52: oldDate } });
  assert.equal(result.length, 1);
  assert.equal(result[0].dispositivo_usuario_id, '52');
  assert.throws(() => normalizeDeviceConfig({ ip: '192.168.0.125', usuarios_fecha_desde: { 52: '2026-02-30' } }));
});

test('lee usuarios sin exponer claves y contabiliza marcaciones sin vincular', async () => {
  class Device {
    async createSocket() {}
    async getInfo() { return {}; }
    async getUsers() { return { data: [{ userId: '52', name: 'Nombre', password: 'NO-EXPOSURE', cardno: 123 }] }; }
    async getAttendances() { return { data: [{ deviceUserId: '52', recordTime: new Date() }] }; }
    async disconnect() {}
  }
  const result = await readZktecoDevice({ ip: '192.168.0.125', usuarios_mapeo: {} }, Device, { includeUsers: true });
  assert.deepEqual(result.users, [{ dispositivo_usuario_id: '52', nombre: 'Nombre' }]);
  assert.equal(result.unmappedCount, 1);
  assert.equal(result.unmappedUsers, 1);
  assert.equal(result.records.length, 0);
  assert.equal(result.rawRecords.length, 1);
});

test('serializa lecturas simultaneas al mismo equipo', async () => {
  let active = 0;
  let peak = 0;
  class Device {
    async createSocket() { active++; peak = Math.max(peak, active); }
    async getInfo() { return {}; }
    async getAttendances() { return { data: [] }; }
    async disconnect() { active--; }
  }
  await Promise.all([readZktecoDevice({ ip: '10.0.0.20' }, Device), readZktecoDevice({ ip: '10.0.0.20' }, Device)]);
  assert.equal(peak, 1);
  assert.equal(active, 0);
});

test('solo permite conectar el biometrico a una IPv4 local', () => {
  assert.equal(normalizeDeviceConfig({ ip: '192.168.10.25' }).port, 4370);
  assert.throws(() => normalizeDeviceConfig({ ip: '8.8.8.8' }), /solo se permiten direcciones IP privadas/);
  assert.throws(() => normalizeDeviceConfig({ ip: 'biometrico.local' }), /IPv4 local valida/);
});

test('vincula solo IDs confirmados y mantiene la referencia del evento original', () => {
  const records = ['2', 'AMIN_ALARCON', '52'].map(deviceUserId => ({ deviceUserId, recordTime: new Date() }));
  const config = { ip: '192.168.0.125', usuarios_mapeo: { '2': 'AMIN_ALARCON' } };
  const mapped = normalizeAttendanceRecords(records, config);
  const original = normalizeAttendanceRecords(records, { ip: config.ip });
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].empleado_codigo, 'AMIN_ALARCON');
  assert.equal(mapped[0].dispositivo_usuario_id, '2');
  assert.equal(mapped[0].referencia, original.find(x => x.empleado_codigo === '2').referencia);
  assert.equal(normalizeAttendanceRecords(records, { ...config, usuarios_mapeo: {} }).length, 0);
});

test('limita la prueba desde una fecha y rechaza configuraciones invalidas', () => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const startDate = deviceDateToTimestamp(today).slice(0, 10);
  const records = [yesterday, today].map(recordTime => ({ deviceUserId: '2', recordTime }));
  assert.equal(normalizeAttendanceRecords(records, { ip: '192.168.0.125', fecha_desde: startDate }).length, 1);
  for (const value of [null, [], { '2': '' }, { '2': 123 }]) {
    assert.throws(() => normalizeDeviceConfig({ ip: '192.168.0.125', usuarios_mapeo: value }));
  }
  assert.throws(() => normalizeDeviceConfig({ ip: '192.168.0.125', fecha_desde: '2026-02-30' }));
  assert.throws(() => normalizeDeviceConfig({ ip: '192.168.0.125', dias_importar: 'invalido' }));
});

test('una descarga parcial no se interpreta como una jornada completa', async () => {
  class PartialDevice {
    async createSocket() {}
    async getInfo() { return {}; }
    async getAttendances() { return { data: [], err: new Error('descarga incompleta') }; }
    async disconnect() {}
  }
  await assert.rejects(readZktecoDevice({ ip: '192.168.0.125' }, PartialDevice), /descarga incompleta/);
});

test('conserva la hora local del dispositivo con offset de Ecuador', () => {
  const date = new Date(2026, 8, 2, 8, 5, 9);
  assert.equal(deviceDateToTimestamp(date), '2026-09-02T08:05:09-05:00');
});

test('asigna entrada, almuerzo y salida segun las marcaciones disponibles', () => {
  const records = ['08:00', '12:00', '13:00', '17:00'].map((time, index) => ({
    empleado_codigo: '15',
    fecha_local: '2026-09-02',
    marcado_en: `2026-09-02T${time}:00-05:00`,
    referencia: String(index),
  }));

  const result = assignAttendanceTypes(records);
  assert.deepEqual(result.records.map((record) => record.tipo), [
    'entrada',
    'salida_almuerzo',
    'entrada_almuerzo',
    'salida',
  ]);
  assert.equal(result.omitted, 0);
});

test('lee informacion y registros del dispositivo en forma secuencial', async () => {
  const calls = [];
  class FakeZKLib {
    async createSocket() { calls.push('connect'); }
    async getInfo() { calls.push('info'); return { logCounts: 1 }; }
    async getAttendances() {
      calls.push('attendance');
      return { data: [{ deviceUserId: 'EMP-1', recordTime: new Date() }] };
    }
    async disconnect() { calls.push('disconnect'); }
  }

  const result = await readZktecoDevice({ ip: '10.0.0.20', dias_importar: 1 }, FakeZKLib);
  assert.equal(result.records.length, 1);
  assert.deepEqual(calls, ['connect', 'info', 'attendance', 'disconnect']);
});

test('presenta el error real de ZKLib y desconecta despues de una falla', async () => {
  let disconnected = false;
  class OfflineZKLib {
    async createSocket() { throw { err: new Error('TIMEOUT_ON_WRITING_MESSAGE'), command: 'UDP CONNECT' }; }
    async disconnect() { disconnected = true; }
  }
  await assert.rejects(
    readZktecoDevice({ ip: '192.168.0.125' }, OfflineZKLib),
    /192\.168\.0\.125:4370: TIMEOUT_ON_WRITING_MESSAGE/,
  );
  assert.equal(disconnected, true);
});
