const { z } = require('zod');
const { emptyBody, paginationQuery, uuid, isoDate, preprocessEmpty } = require('./common.validator');

const listAuditSchema = z.object({
  body: emptyBody,
  params: z.object({}).passthrough(),
  query: paginationQuery.extend({
    usuario_id: uuid('usuario_id').optional(),
    entidad: z.string().trim().max(80).optional(),
    metodo: preprocessEmpty(z.enum(['POST', 'PUT', 'PATCH', 'DELETE'])).optional(),
    fecha_desde: isoDate('fecha_desde').optional(),
    fecha_hasta: isoDate('fecha_hasta').optional(),
  }),
});

module.exports = { listAuditSchema };
