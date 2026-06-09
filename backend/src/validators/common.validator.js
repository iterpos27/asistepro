const { z } = require('zod');

const emptyBody = z.object({}).passthrough();
const emptyQuery = z.object({}).passthrough();
const emptyParams = z.object({}).passthrough();

const uuid = (field = 'id') => z.uuid(`${field} invalido`);

const idParams = z.object({
  id: uuid('id'),
});

const idParamSchema = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: idParams,
});

const paginationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .passthrough();

function updateBodySchema(bodySchema) {
  return bodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });
}

module.exports = {
  emptyBody,
  emptyParams,
  emptyQuery,
  idParamSchema,
  idParams,
  paginationQuery,
  updateBodySchema,
  uuid,
};
