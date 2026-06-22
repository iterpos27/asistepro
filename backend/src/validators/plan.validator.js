const { z } = require('zod');
const { emptyBody, emptyParams, emptyQuery, idParams, updateBodySchema } = require('./common.validator');

const planBody = z.object({
  codigo: z.string().trim().min(1, 'codigo es requerido').max(30).toLowerCase(),
  nombre: z.string().trim().min(1, 'nombre es requerido').max(100),
  descripcion: z.string().trim().max(500).optional().nullable(),
  precio_mensual: z.coerce.number().min(0, 'precio_mensual no puede ser negativo'),
  limite_empleados: z.coerce.number().int().min(1).optional().nullable(),
  limite_sucursales: z.coerce.number().int().min(1).optional().nullable(),
  activo: z.boolean().optional(),
});

const listPlanesSchema = z.object({
  body: emptyBody,
  query: z.object({
    incluir_inactivos: z.enum(['true', 'false']).optional(),
  }).passthrough(),
  params: emptyParams,
});

const createPlanSchema = z.object({
  body: planBody,
  query: emptyQuery,
  params: emptyParams,
});

const updatePlanSchema = z.object({
  body: updateBodySchema(planBody),
  query: emptyQuery,
  params: idParams,
});

const idParamSchema = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: idParams,
});

module.exports = {
  createPlanSchema,
  idParamSchema,
  listPlanesSchema,
  updatePlanSchema,
};
