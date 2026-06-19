const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, updateBodySchema } = require('./common.validator');

const integrationBodyBase = z.object({
  nombre: z.string().trim().min(1).max(160),
  tipo: z.enum(['nomina', 'biometrico', 'storage']),
  proveedor: z.string().trim().min(1).max(80),
  estado: z.enum(['activa', 'inactiva', 'error']).optional(),
  api_key: z.string().trim().max(255).optional(),
  configuracion: z.record(z.string(), z.any()).optional(),
});

const runIntegrationBody = z.object({
  mes: z.string().trim().optional(),
  marcaciones: z.array(z.object({
    empleado_codigo: z.string().trim().min(1).max(50),
    tipo: z.enum(['entrada', 'salida']),
    marcado_en: z.string().trim().optional(),
    fecha_hora: z.string().trim().optional(),
    sucursal_id: z.uuid('sucursal_id invalido').optional(),
  })).optional(),
}).passthrough();

const createIntegrationSchema = z.object({
  body: integrationBodyBase,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateIntegrationSchema = z.object({
  body: updateBodySchema(integrationBodyBase),
  query: z.object({}).passthrough(),
  params: idParams,
});

const runIntegrationSchema = z.object({
  body: runIntegrationBody,
  query: z.object({}).passthrough(),
  params: idParams,
});

module.exports = {
  createIntegrationSchema,
  idParamSchema,
  runIntegrationSchema,
  updateIntegrationSchema,
};
