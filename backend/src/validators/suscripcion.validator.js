const { z } = require('zod');
const { emptyBody, emptyParams, emptyQuery, idParams, updateBodySchema, uuid, isoDate } = require('./common.validator');

const suscripcionBody = z.object({
  empresa_id: uuid('empresa_id'),
  plan_id: uuid('plan_id'),
  estado: z.enum(['activa', 'vencida', 'cancelada', 'suspendida']).optional(),
  monto_mensual: z.coerce.number().min(0, 'monto_mensual no puede ser negativo').optional(),
  fecha_inicio: isoDate('fecha_inicio').optional(),
  fecha_fin: isoDate('fecha_fin').optional(),
});

const listSuscripcionesSchema = z.object({
  body: emptyBody,
  query: z.object({
    empresa_id: uuid('empresa_id').optional(),
    estado: z.enum(['activa', 'vencida', 'cancelada', 'suspendida']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }).passthrough(),
  params: emptyParams,
});

const createSuscripcionSchema = z.object({
  body: suscripcionBody,
  query: emptyQuery,
  params: emptyParams,
});

const updateSuscripcionSchema = z.object({
  body: updateBodySchema(suscripcionBody),
  query: emptyQuery,
  params: idParams,
});

const idParamSchema = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: idParams,
});

module.exports = {
  createSuscripcionSchema,
  idParamSchema,
  listSuscripcionesSchema,
  updateSuscripcionSchema,
};
