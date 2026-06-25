const { z } = require('zod');
const { emptyParams, emptyQuery } = require('./common.validator');

const changePasswordSchema = z
  .object({
    body: z
      .object({
        currentPassword: z.string().min(1, 'contrasena actual requerida'),
        newPassword: z.string().min(8, 'nueva contrasena debe tener al menos 8 caracteres'),
        confirmPassword: z.string().min(8, 'confirmacion requerida'),
      })
      .refine((payload) => payload.newPassword === payload.confirmPassword, {
        message: 'Las contrasenas no coinciden',
        path: ['confirmPassword'],
      }),
    query: emptyQuery,
    params: emptyParams,
  });

const registerTenantSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre de la empresa es requerido'),
    identificacion_fiscal: z.string().min(1, 'La identificacion fiscal es requerida'),
    email: z.string().email('El email de la empresa no es valido'),
    telefono: z.string().optional().nullable(),
    direccion: z.string().optional().nullable(),
    plan_id: z.string().uuid('plan_id debe ser un UUID valido'),
    admin_nombre: z.string().min(1, 'El nombre del administrador es requerido'),
    admin_apellido: z.string().min(1, 'El apellido del administrador es requerido'),
    admin_email: z.string().email('El email del administrador no es valido'),
    admin_password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
    admin_cedula: z.string().min(1, 'La cedula del administrador es requerida').max(20),
    admin_username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(100).regex(/^[a-zA-Z0-9_.]+$/, 'El nombre de usuario solo puede contener letras, números, puntos y guiones bajos').optional().nullable(),
  }),
  query: emptyQuery,
  params: emptyParams,
});

module.exports = {
  changePasswordSchema,
  registerTenantSchema,
};
