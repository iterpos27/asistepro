const { z } = require('zod');
const { emptyQuery, idParams, uuid } = require('./common.validator');
const permissions = z.record(z.string(), z.record(z.string(), z.boolean())).default({});
const roleBody = z.object({ nombre: z.string().trim().min(3).max(100), descripcion: z.string().trim().max(500).optional().nullable(), rol_base: z.enum(['ADMIN_EMPRESA','RRHH','EMPLEADO']), permisos: permissions, activo: z.boolean().optional() });
const roleSchema = z.object({ body: roleBody, query: emptyQuery, params: z.object({}).passthrough() });
const updateRoleSchema = z.object({ body: roleBody, query: emptyQuery, params: idParams });
const assignRoleSchema = z.object({ body: z.object({ rol_personalizado_id: uuid('rol_personalizado_id').optional().nullable(), permisos: permissions.optional() }), query: emptyQuery, params: idParams });
module.exports = { assignRoleSchema, roleSchema, updateRoleSchema };
