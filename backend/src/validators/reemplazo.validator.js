const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, isoDate, paginationQuery, updateBodySchema, uuid } = require('./common.validator');

const time = (field) => z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/, `${field} invalida`);
const estado = z.enum(['activo', 'cancelado', 'finalizado']);

const reemplazoBodyBase = z.object({
  empleado_id: uuid('empleado_id'),
  sucursal_id: uuid('sucursal_id'),
  fecha_inicio: isoDate('fecha_inicio'),
  fecha_fin: isoDate('fecha_fin'),
  hora_inicio: time('hora_inicio').optional().nullable(),
  hora_fin: time('hora_fin').optional().nullable(),
  motivo: z.string().trim().min(1, 'motivo es requerido').max(160),
  observacion: z.string().trim().max(1000).optional().nullable(),
  estado: estado.optional(),
});

function withDateTimeRules(schema) {
  return schema.refine((payload) => !payload.fecha_inicio || !payload.fecha_fin || payload.fecha_inicio <= payload.fecha_fin, {
    message: 'fecha_inicio no puede ser mayor que fecha_fin',
    path: ['fecha_inicio'],
  }).refine((payload) => !payload.hora_inicio || !payload.hora_fin || payload.hora_fin > payload.hora_inicio, {
    message: 'hora_fin debe ser mayor que hora_inicio',
    path: ['hora_fin'],
  });
}

const reemplazoBody = withDateTimeRules(reemplazoBodyBase);

const createReemplazoSchema = z.object({
  body: reemplazoBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateReemplazoSchema = z
  .object({
    body: withDateTimeRules(updateBodySchema(reemplazoBodyBase)),
    query: z.object({}).passthrough(),
    params: idParams,
  })
  .refine(({ body }) => !body.fecha_inicio || !body.fecha_fin || body.fecha_inicio <= body.fecha_fin, {
    message: 'fecha_inicio no puede ser mayor que fecha_fin',
    path: ['body', 'fecha_inicio'],
  })
  .refine(({ body }) => !body.hora_inicio || !body.hora_fin || body.hora_fin > body.hora_inicio, {
    message: 'hora_fin debe ser mayor que hora_inicio',
    path: ['body', 'hora_fin'],
  });

const listReemplazosSchema = z
  .object({
    body: emptyBody,
    query: paginationQuery.extend({
      empleado_id: uuid('empleado_id').optional(),
      sucursal_id: uuid('sucursal_id').optional(),
      estado: estado.optional(),
      fecha_desde: isoDate('fecha_desde').optional(),
      fecha_hasta: isoDate('fecha_hasta').optional(),
    }),
    params: emptyParams,
  })
  .refine(({ query }) => !query.fecha_desde || !query.fecha_hasta || query.fecha_desde <= query.fecha_hasta, {
    message: 'fecha_desde no puede ser mayor que fecha_hasta',
    path: ['query', 'fecha_desde'],
  });

module.exports = {
  createReemplazoSchema,
  idParamSchema,
  listReemplazosSchema,
  updateReemplazoSchema,
};
