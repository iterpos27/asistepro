const { z } = require('zod');
const { emptyBody, emptyQuery, idParams, isoDate, paginationQuery, uuid, preprocessEmpty } = require('./common.validator');

const correctionSchema = z.object({
  accion: z.enum(['crear', 'editar', 'anular']),
  marcacion_id: uuid('marcacion_id').optional().nullable(),
  tipo: z.enum(['entrada', 'salida']).optional().nullable(),
  marcado_en: z.iso.datetime({ offset: true }).optional().nullable(),
  sucursal_id: uuid('sucursal_id').optional().nullable(),
}).superRefine((value, context) => {
  if (['editar', 'anular'].includes(value.accion) && !value.marcacion_id) context.addIssue({ code: 'custom', path: ['marcacion_id'], message: 'marcacion_id es requerido' });
  if (['crear', 'editar'].includes(value.accion) && (!value.tipo || !value.marcado_en || !value.sucursal_id)) context.addIssue({ code: 'custom', path: ['marcado_en'], message: 'tipo, marcado_en y sucursal_id son requeridos' });
});

const body = z.object({
  empleado_id: uuid('empleado_id').optional(),
  tipo: z.enum(['vacaciones', 'permiso', 'incapacidad', 'ausencia', 'correccion_marcacion']),
  fecha_inicio: isoDate('fecha_inicio'),
  fecha_fin: isoDate('fecha_fin'),
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  hora_fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  motivo: z.string().trim().min(5).max(1000),
  datos_correccion: correctionSchema.optional().nullable(),
  comprobante_storage_provider: z.string().trim().max(40).optional().nullable(),
  comprobante_storage_bucket: z.string().trim().max(120).optional().nullable(),
  comprobante_storage_key: z.string().trim().optional().nullable(),
  comprobante_storage_url: z.string().trim().optional().nullable(),
  comprobante: z.object({
    nombre: z.string().trim().min(1),
    tipo: z.string().trim().min(1),
    data_base64: z.string().min(1),
  }).optional().nullable(),
}).superRefine((value, context) => {
  if (value.fecha_fin < value.fecha_inicio) context.addIssue({ code: 'custom', path: ['fecha_fin'], message: 'fecha_fin no puede ser anterior' });
  if (Boolean(value.hora_inicio) !== Boolean(value.hora_fin)) context.addIssue({ code: 'custom', path: ['hora_fin'], message: 'Debe completar ambas horas' });
  if (value.tipo === 'correccion_marcacion' && !value.datos_correccion) context.addIssue({ code: 'custom', path: ['datos_correccion'], message: 'Datos de correccion requeridos' });
  const correctionDate = value.datos_correccion?.marcado_en?.slice(0, 10);
  if (correctionDate && (correctionDate < value.fecha_inicio || correctionDate > value.fecha_fin)) context.addIssue({ code: 'custom', path: ['datos_correccion', 'marcado_en'], message: 'La marcacion propuesta debe estar dentro del periodo solicitado' });
});

const createSolicitudSchema = z.object({ body, query: emptyQuery, params: z.object({}).passthrough() });
const listSolicitudesSchema = z.object({ body: emptyBody, params: z.object({}).passthrough(), query: paginationQuery.extend({
  estado: preprocessEmpty(z.enum(['pendiente', 'aprobada', 'rechazada', 'cancelada'])).optional(),
  tipo: preprocessEmpty(z.enum(['vacaciones', 'permiso', 'incapacidad', 'ausencia', 'correccion_marcacion'])).optional(),
  empleado_id: uuid('empleado_id').optional(),
}) });
const reviewSolicitudSchema = z.object({ body: z.object({ decision: z.enum(['aprobar', 'rechazar']), comentario: z.string().trim().max(1000).optional().nullable() }), query: emptyQuery, params: idParams });
const idSolicitudSchema = z.object({ body: emptyBody, query: emptyQuery, params: idParams });

module.exports = { createSolicitudSchema, idSolicitudSchema, listSolicitudesSchema, reviewSolicitudSchema };
