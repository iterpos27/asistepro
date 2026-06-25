const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, paginationQuery, updateBodySchema, uuid } = require('./common.validator');

const time = (field) => z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/, `${field} invalida`);
const dateText = (field) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${field} invalida`);

const horarioBody = z.object({
  sucursal_id: uuid('sucursal_id').optional().nullable(),
  nombre: z.string().trim().min(1, 'nombre es requerido').max(120),
  descripcion: z.string().trim().max(260).optional().nullable(),
  dias_semana: z.array(z.coerce.number().int().min(1).max(7)).min(1, 'dias_semana es requerido'),
  hora_inicio: time('hora_inicio'),
  hora_fin: time('hora_fin'),
  tolerancia_minutos: z.coerce.number().int().min(0).max(10, 'La tolerancia máxima permitida es de 10 minutos').optional(),
  descanso_minutos: z.coerce.number().int().min(0).max(720).optional(),
  activo: z.coerce.boolean().optional(),
});

const asignacionBody = z.object({
  empleado_id: uuid('empleado_id'),
  horario_id: uuid('horario_id'),
  fecha_inicio: dateText('fecha_inicio').optional().nullable(),
  fecha_fin: dateText('fecha_fin').optional().nullable(),
  activo: z.coerce.boolean().optional(),
});

const listHorariosSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    activo: z.enum(['true', 'false']).optional(),
    sucursal_id: uuid('sucursal_id').optional(),
  }),
  params: emptyParams,
});

const listAsignacionesSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    activo: z.enum(['true', 'false']).optional(),
    empleado_id: uuid('empleado_id').optional(),
  }),
  params: emptyParams,
});

const createHorarioSchema = z.object({
  body: horarioBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateHorarioSchema = z.object({
  body: updateBodySchema(horarioBody),
  query: z.object({}).passthrough(),
  params: idParams,
});

const assignHorarioSchema = z.object({
  body: asignacionBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

module.exports = {
  assignHorarioSchema,
  createHorarioSchema,
  idParamSchema,
  listAsignacionesSchema,
  listHorariosSchema,
  updateHorarioSchema,
};
