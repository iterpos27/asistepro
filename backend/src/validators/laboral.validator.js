const { z } = require('zod');
const { emptyBody, emptyParams, emptyQuery, isoMonth } = require('./common.validator');

const monthParams = z.object({ mes: isoMonth('mes') });
const monthParamSchema = z.object({ body: emptyBody, query: emptyQuery, params: monthParams });
const reopenSchema = z.object({
  body: z.object({ motivo: z.string().trim().min(5).max(500) }),
  query: emptyQuery,
  params: monthParams,
});
const timeSchema = (field) => z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${field} debe tener formato HH:mm`);
const optionalNumber = (field, min = 0) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce.number().min(min, `${field} invalido`).optional());
const optionalInteger = (field, min = 0) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce.number().int().min(min, `${field} invalido`).optional());

const reglasBody = z.object({
  jornada_diaria_minutos: optionalInteger('jornada_diaria_minutos', 1),
  jornada_semanal_minutos: optionalInteger('jornada_semanal_minutos', 1),
  base_calculo_mensual_horas: optionalNumber('base_calculo_mensual_horas', 1),
  dias_base_mes: optionalNumber('dias_base_mes', 1),
  tolerancia_atraso_minutos: optionalInteger('tolerancia_atraso_minutos', 0),
  almuerzo_minutos: optionalInteger('almuerzo_minutos', 0),
  almuerzo_inicio: timeSchema('almuerzo_inicio').optional(),
  almuerzo_fin: timeSchema('almuerzo_fin').optional(),
  descontar_almuerzo_automatico: z.coerce.boolean().optional(),
  hora_inicio_nocturna: timeSchema('hora_inicio_nocturna').optional(),
  hora_fin_nocturna: timeSchema('hora_fin_nocturna').optional(),
  recargo_suplementaria: optionalNumber('recargo_suplementaria', 1),
  recargo_extraordinaria: optionalNumber('recargo_extraordinaria', 1),
  recargo_nocturna: optionalNumber('recargo_nocturna', 1),
  recargo_feriado: optionalNumber('recargo_feriado', 1),
  redondeo_minutos: optionalInteger('redondeo_minutos', 1),
  ausencia_permiso_pagado: z.coerce.boolean().optional(),
  ausencia_incapacidad_pagada: z.coerce.boolean().optional(),
  activo: z.coerce.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Debe enviar al menos una regla laboral' });

const reglasSchema = z.object({ body: reglasBody, query: emptyQuery, params: emptyParams });

module.exports = { monthParamSchema, reglasSchema, reopenSchema };
