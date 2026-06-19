const assert = require('node:assert/strict');
const test = require('node:test');
const { validateSuscripcionPayload } = require('../src/services/suscripcion.service');

test('validateSuscripcionPayload - requiere campos obligatorios al crear', () => {
  assert.throws(() => {
    validateSuscripcionPayload({}, { partial: false });
  }, /empresa_id es requerido/);

  assert.throws(() => {
    validateSuscripcionPayload({ empresa_id: 'empresa-a' }, { partial: false });
  }, /plan_id es requerido/);
});

test('validateSuscripcionPayload - rechaza fecha_inicio en el pasado', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  assert.throws(() => {
    validateSuscripcionPayload({
      empresa_id: 'empresa-a',
      plan_id: 'plan-b',
      fecha_inicio: yesterday,
    }, { partial: false });
  }, /La fecha de inicio no puede ser anterior a la actual/);
});

test('validateSuscripcionPayload - acepta fecha_inicio actual o futura', () => {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  // Should auto-fill end date correctly and not throw
  const payload1 = {
    empresa_id: 'empresa-a',
    plan_id: 'plan-b',
    fecha_inicio: today,
  };
  validateSuscripcionPayload(payload1, { partial: false });
  assert.ok(payload1.fecha_fin);
  
  const payload2 = {
    empresa_id: 'empresa-a',
    plan_id: 'plan-b',
    fecha_inicio: future,
  };
  validateSuscripcionPayload(payload2, { partial: false });
  assert.ok(payload2.fecha_fin);
});

test('validateSuscripcionPayload - rechaza duracion diferente de 30 dias', () => {
  const today = new Date().toISOString().slice(0, 10);
  const end29 = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end31 = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  assert.throws(() => {
    validateSuscripcionPayload({
      empresa_id: 'empresa-a',
      plan_id: 'plan-b',
      fecha_inicio: today,
      fecha_fin: end29,
    }, { partial: false });
  }, /El periodo de la suscripcion debe ser de exactamente 30 dias/);

  assert.throws(() => {
    validateSuscripcionPayload({
      empresa_id: 'empresa-a',
      plan_id: 'plan-b',
      fecha_inicio: today,
      fecha_fin: end31,
    }, { partial: false });
  }, /El periodo de la suscripcion debe ser de exactamente 30 dias/);
});

test('validateSuscripcionPayload - acepta duracion exacta de 30 dias', () => {
  const today = new Date().toISOString().slice(0, 10);
  const end30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  assert.doesNotThrow(() => {
    validateSuscripcionPayload({
      empresa_id: 'empresa-a',
      plan_id: 'plan-b',
      fecha_inicio: today,
      fecha_fin: end30,
    }, { partial: false });
  });
});
