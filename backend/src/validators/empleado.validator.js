const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, paginationQuery, updateBodySchema, uuid } = require('./common.validator');

const empleadoBodyBase = z.object({
  usuario_id: uuid('usuario_id').optional().nullable(),
  sucursal_habitual_id: uuid('sucursal_habitual_id').optional().nullable(),
  codigo: z.string().trim().min(1, 'codigo es requerido').max(40),
  nombres: z.string().trim().min(1, 'nombres es requerido').max(120),
  apellidos: z.string().trim().min(1, 'apellidos es requerido').max(120),
  email: z.email('email invalido').optional().nullable(),
  telefono: z.string().trim().max(40).optional().nullable(),
  cargo: z.string().trim().max(120).optional().nullable(),
  departamento: z.string().trim().max(120).optional().nullable(),
  area_estructura_id: uuid('area_estructura_id').optional().nullable(),
  cargo_estructura_id: uuid('cargo_estructura_id').optional().nullable(),
  centro_costo_estructura_id: uuid('centro_costo_estructura_id').optional().nullable(),
  supervisor_empleado_id: uuid('supervisor_empleado_id').optional().nullable(),
  tipo_contrato: z.string().trim().max(50).optional().nullable(),
  salario_base: z.coerce.number().min(0, 'salario_base no puede ser negativo').optional().nullable(),
  fecha_ingreso: z.string().trim().optional().nullable(),
  estado: z.enum(['activo', 'inactivo', 'suspendido']).optional(),
  crear_usuario: z.coerce.boolean().optional(),
  password_acceso: z.string().min(8, 'password_acceso debe tener al menos 8 caracteres').optional(),
  rol_acceso: z.enum(['EMPLEADO', 'RRHH']).optional(),
});

function withUsuarioAccessRules(schema) {
  return schema
  .refine((payload) => !payload.crear_usuario || Boolean(payload.email), {
    message: 'email es requerido para crear usuario',
    path: ['email'],
  })
  .refine((payload) => !payload.crear_usuario || Boolean(payload.password_acceso), {
    message: 'password_acceso es requerido para crear usuario',
    path: ['password_acceso'],
  });
}

const empleadoBody = withUsuarioAccessRules(empleadoBodyBase);
const empleadoUpdateBody = withUsuarioAccessRules(updateBodySchema(empleadoBodyBase));

const listEmpleadosSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    estado: z.enum(['activo', 'inactivo', 'suspendido']).optional(),
    sucursal_id: uuid('sucursal_id').optional(),
    area_id: uuid('area_id').optional(),
    supervisor_id: uuid('supervisor_id').optional(),
    tipo_contrato: z.string().trim().max(50).optional(),
  }),
  params: emptyParams,
});

const createEmpleadoSchema = z.object({
  body: empleadoBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateEmpleadoSchema = z.object({
  body: empleadoUpdateBody,
  query: z.object({}).passthrough(),
  params: idParams,
});

module.exports = {
  createEmpleadoSchema,
  idParamSchema,
  listEmpleadosSchema,
  updateEmpleadoSchema,
};
