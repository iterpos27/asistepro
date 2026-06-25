const { z } = require('zod');
const { emptyBody, emptyParams, paginationQuery, requiredNumber } = require('./common.validator');

const uuidParamSchema = z.object({
  params: z.object({
    id: z.uuid('id invalido'),
  }),
});

const sucursalBodySchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  codigo: z.string().trim().min(1, 'codigo es requerido'),
  direccion: z.string().trim().optional().nullable(),
  ciudad: z.string().trim().optional().nullable(),
  latitud: requiredNumber('latitud', {
    min: { value: -90, message: 'latitud invalida' },
    max: { value: 90, message: 'latitud invalida' },
  }),
  longitud: requiredNumber('longitud', {
    min: { value: -180, message: 'longitud invalida' },
    max: { value: 180, message: 'longitud invalida' },
  }),
  radio_metros: z.coerce.number().int().positive('radio_metros debe ser mayor a cero').optional(),
  estado: z.enum(['activa', 'inactiva', 'mantenimiento']).optional(),
  jefe_empleado_id: z.string().uuid('jefe_empleado_id invalido').optional().nullable(),
});

const listSucursalesSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    estado: z.enum(['activa', 'inactiva', 'mantenimiento']).optional(),
  }),
  params: emptyParams,
});

const createSucursalSchema = z.object({
  body: sucursalBodySchema,
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const updateSucursalSchema = z.object({
  body: sucursalBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  }),
  query: z.object({}).passthrough(),
  params: uuidParamSchema.shape.params,
});

const idParamSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: uuidParamSchema.shape.params,
});

module.exports = {
  createSucursalSchema,
  updateSucursalSchema,
  idParamSchema,
  listSucursalesSchema,
};
