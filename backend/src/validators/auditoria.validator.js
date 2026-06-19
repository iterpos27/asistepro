const { z } = require('zod');
const { emptyBody, paginationQuery, uuid } = require('./common.validator');
const listAuditSchema = z.object({ body: emptyBody, params: z.object({}).passthrough(), query: paginationQuery.extend({
  usuario_id: uuid('usuario_id').optional(), entidad: z.string().trim().max(80).optional(),
  metodo: z.enum(['POST','PUT','PATCH','DELETE']).optional(), fecha_desde: z.string().date().optional(), fecha_hasta: z.string().date().optional(),
}) });
module.exports = { listAuditSchema };
