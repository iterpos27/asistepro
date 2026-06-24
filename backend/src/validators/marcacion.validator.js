const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, isoDate, paginationQuery, requiredNumber, uuid, maybeIsoDate, maybeUuid } = require('./common.validator');

const marcacionEstado = z.enum(['aceptada', 'aceptada_con_novedad', 'rechazada']);

const marcacionSchema = z.object({
  body: z.object({
    qr_token: z.string().trim().min(1, 'qr_token es requerido'),
    tipo: z.enum(['entrada', 'salida'], { message: 'tipo debe ser entrada o salida' }),
    empleado_id: z.uuid('empleado_id invalido').optional(),
    latitud: requiredNumber('latitud', {
      min: { value: -90, message: 'latitud invalida' },
      max: { value: 90, message: 'latitud invalida' },
    }),
    longitud: requiredNumber('longitud', {
      min: { value: -180, message: 'longitud invalida' },
      max: { value: 180, message: 'longitud invalida' },
    }),
    precision_gps: z.coerce.number().nonnegative('precision_gps invalida').optional(),
    accuracy: z.coerce.number().nonnegative('accuracy invalida').optional(),
    motivo_novedad: z
      .enum(['Reemplazo', 'Apoyo temporal', 'Emergencia', 'Autorizacion supervisor', 'Otro'])
      .optional(),
    detalle_novedad: z.string().trim().optional().nullable(),
    marcado_en: z.string().trim().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const listMarcacionesSchema = z
  .object({
    body: emptyBody,
    query: paginationQuery.extend({
      empleado_id: maybeUuid('empleado_id'),
      sucursal_id: maybeUuid('sucursal_id'),
      estado: marcacionEstado.optional(),
      fecha_desde: maybeIsoDate('fecha_desde'),
      fecha_hasta: maybeIsoDate('fecha_hasta'),
      solo_mios: z.string().optional(),
    }),
    params: emptyParams,
  })
  .refine(
    ({ query }) =>
      !query.fecha_desde || !query.fecha_hasta || query.fecha_desde <= query.fecha_hasta,
    {
      message: 'fecha_desde no puede ser mayor que fecha_hasta',
      path: ['query', 'fecha_desde'],
    },
  );

module.exports = {
  idParamSchema,
  listMarcacionesSchema,
  marcacionSchema,
};
