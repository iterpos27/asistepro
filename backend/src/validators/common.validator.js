const { z } = require('zod');

const emptyBody = z.object({}).passthrough().optional().nullable();
const emptyQuery = z.object({}).passthrough().optional().nullable();
const emptyParams = z.object({}).passthrough().optional().nullable();

const uuid = (field = 'id') =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().uuid(`${field} invalido`)
  );

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isoDate = (field = 'fecha') =>
  z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z
      .string()
      .trim()
      .refine(isValidIsoDate, `${field} debe tener formato YYYY-MM-DD`)
  );

const isoMonth = (field = 'mes') =>
  z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z
      .string()
      .trim()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, `${field} debe tener formato YYYY-MM`)
  );

const preprocessEmpty = (schema) =>
  z.preprocess((val) => (val === '' || val === null ? undefined : val), schema.optional().nullable());

const maybeUuid = (field = 'id') =>
  z.union([z.string().uuid(`${field} invalido`), z.literal(''), z.null(), z.undefined()]).optional();

const maybeIsoDate = (field = 'fecha') =>
  z.union([
    z.string().trim().refine(isValidIsoDate, `${field} debe tener formato YYYY-MM-DD`),
    z.literal(''),
    z.null(),
    z.undefined(),
  ]).optional();

const maybeIsoMonth = (field = 'mes') =>
  z.union([
    z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, `${field} debe tener formato YYYY-MM`),
    z.literal(''),
    z.null(),
    z.undefined(),
  ]).optional();

function requiredNumber(field = 'valor', { min, max } = {}) {
  let schema = z.coerce.number({ message: `${field} es requerido` });

  if (min !== undefined) {
    schema = schema.min(min.value, min.message || `${field} invalido`);
  }

  if (max !== undefined) {
    schema = schema.max(max.value, max.message || `${field} invalido`);
  }

  return z.preprocess((value) => (value === '' || value === null ? undefined : value), schema);
}

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
    limit: z.coerce.number().int().min(1).max(500).optional(),
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
  isoDate,
  isoMonth,
  maybeUuid,
  maybeIsoDate,
  maybeIsoMonth,
  paginationQuery,
  preprocessEmpty,
  requiredNumber,
  updateBodySchema,
  uuid,
};
