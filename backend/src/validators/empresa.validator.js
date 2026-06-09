const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, paginationQuery, updateBodySchema, uuid } = require('./common.validator');

const empresaBody = z.object({
  plan_id: uuid('plan_id').optional().nullable(),
  nombre: z.string().trim().min(1, 'nombre es requerido').max(160),
  identificacion_fiscal: z.string().trim().max(40).optional().nullable(),
  email: z.email('email invalido').optional().nullable(),
  telefono: z.string().trim().max(40).optional().nullable(),
  direccion: z.string().trim().max(260).optional().nullable(),
  estado: z.enum(['activa', 'suspendida', 'cancelada']).optional(),
});

const createEmpresaBody = empresaBody
  .extend({
    admin_nombre: z.string().trim().max(120).optional(),
    admin_apellido: z.string().trim().max(120).optional(),
    admin_email: z.email('admin_email invalido').optional(),
    admin_telefono: z.string().trim().max(40).optional().nullable(),
    admin_password: z.string().min(8, 'admin_password debe tener al menos 8 caracteres').optional(),
    admin_confirm_password: z.string().min(8, 'confirmacion requerida').optional(),
  })
  .refine((payload) => !payload.admin_email || Boolean(payload.admin_password), {
    message: 'admin_password es requerido',
    path: ['admin_password'],
  })
  .refine((payload) => !payload.admin_password || Boolean(payload.admin_email), {
    message: 'admin_email es requerido',
    path: ['admin_email'],
  })
  .refine((payload) => !payload.admin_password || payload.admin_password === payload.admin_confirm_password, {
    message: 'Las contrasenas no coinciden',
    path: ['admin_confirm_password'],
  });

const listEmpresasSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    estado: z.enum(['activa', 'suspendida', 'cancelada']).optional(),
  }),
  params: emptyParams,
});

const createEmpresaSchema = z.object({
  body: createEmpresaBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateEmpresaSchema = z.object({
  body: updateBodySchema(empresaBody),
  query: z.object({}).passthrough(),
  params: idParams,
});

const updateMiEmpresaSchema = z.object({
  body: updateBodySchema(empresaBody),
  query: z.object({}).passthrough(),
  params: emptyParams,
});

module.exports = {
  createEmpresaSchema,
  idParamSchema,
  listEmpresasSchema,
  updateEmpresaSchema,
  updateMiEmpresaSchema,
};
