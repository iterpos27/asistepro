const { z } = require('zod');

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
  latitud: z.coerce.number().min(-90, 'latitud invalida').max(90, 'latitud invalida'),
  longitud: z.coerce.number().min(-180, 'longitud invalida').max(180, 'longitud invalida'),
  radio_metros: z.coerce.number().int().positive('radio_metros debe ser mayor a cero').optional(),
  estado: z.enum(['activa', 'inactiva', 'mantenimiento']).optional(),
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
};
