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

module.exports = {
  changePasswordSchema,
};
