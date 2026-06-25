const { z } = require('zod');
const { emptyBody, emptyParams, idParams, paginationQuery } = require('./common.validator');

const feriadoBody = z.object({
  nombre: z.string().trim().min(1, 'El nombre del feriado es requerido').max(160),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD'),
  activo: z.coerce.boolean().optional(),
});

const listFeriadosSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    activo: z.enum(['true', 'false']).optional(),
  }),
  params: emptyParams,
});

const createFeriadoSchema = z.object({
  body: feriadoBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateFeriadoSchema = z.object({
  body: feriadoBody.partial(),
  query: z.object({}).passthrough(),
  params: idParams,
});

module.exports = {
  listFeriadosSchema,
  createFeriadoSchema,
  updateFeriadoSchema,
};
