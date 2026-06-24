const { z } = require('zod');
const { emptyBody, paginationQuery, maybeUuid, maybeIsoDate, preprocessEmpty } = require('./common.validator');

const listAuditSchema = z.object({
  body: emptyBody,
  params: z.object({}).passthrough(),
  query: paginationQuery.extend({
    usuario_id: maybeUuid('usuario_id'),
    entidad: z.string().trim().max(80).optional(),
    metodo: preprocessEmpty(z.enum(['POST', 'PUT', 'PATCH', 'DELETE'])).optional(),
    fecha_desde: maybeIsoDate('fecha_desde'),
    fecha_hasta: maybeIsoDate('fecha_hasta'),
  }),
});

module.exports = { listAuditSchema };
