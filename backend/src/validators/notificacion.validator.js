const { z } = require('zod');
const { emptyBody, idParamSchema, paginationQuery } = require('./common.validator');

const listNotificacionesSchema = z.object({
  body: emptyBody,
  query: paginationQuery,
  params: z.object({}).passthrough(),
});

const subscribePushSchema = z.object({
  body: z.object({
    endpoint: z.url('endpoint invalido'),
    keys: z.object({
      p256dh: z.string().trim().min(1),
      auth: z.string().trim().min(1),
    }),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

module.exports = {
  listNotificacionesSchema,
  idParamSchema,
  subscribePushSchema,
};
