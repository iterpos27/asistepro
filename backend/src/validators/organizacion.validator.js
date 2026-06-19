const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, paginationQuery, updateBodySchema, uuid } = require('./common.validator');

const structureBodyBase = z.object({
  parent_id: uuid('parent_id').optional().nullable(),
  tipo: z.enum(['direccion', 'departamento', 'area', 'cargo', 'centro_costo', 'unidad']),
  codigo: z.string().trim().min(1).max(50),
  nombre: z.string().trim().min(1).max(160),
  descripcion: z.string().trim().max(500).optional().nullable(),
  responsable_empleado_id: uuid('responsable_empleado_id').optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
  activo: z.coerce.boolean().optional(),
});

const importBody = z.object({
  nombre_archivo: z.string().trim().min(1).max(255),
  archivo_base64: z.string().trim().min(20, 'archivo_base64 es requerido'),
});

const listStructuresSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    tipo: z.enum(['direccion', 'departamento', 'area', 'cargo', 'centro_costo', 'unidad']).optional(),
    activo: z.coerce.boolean().optional(),
  }),
  params: emptyParams,
});

const createStructureSchema = z.object({
  body: structureBodyBase,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateStructureSchema = z.object({
  body: updateBodySchema(structureBodyBase),
  query: z.object({}).passthrough(),
  params: idParams,
});

const importEmployeesSchema = z.object({
  body: importBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

module.exports = {
  createStructureSchema,
  idParamSchema,
  importEmployeesSchema,
  listStructuresSchema,
  updateStructureSchema,
};
