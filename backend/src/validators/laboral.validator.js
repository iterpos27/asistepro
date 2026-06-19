const { z } = require('zod');
const { emptyBody, emptyParams, emptyQuery, isoMonth } = require('./common.validator');

const monthParams = z.object({ mes: isoMonth('mes') });
const monthParamSchema = z.object({ body: emptyBody, query: emptyQuery, params: monthParams });
const reopenSchema = z.object({
  body: z.object({ motivo: z.string().trim().min(5).max(500) }),
  query: emptyQuery,
  params: monthParams,
});

module.exports = { monthParamSchema, reopenSchema };
