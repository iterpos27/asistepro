const { z } = require('zod');
const { emptyBody, emptyParams, idParamSchema, idParams, paginationQuery, updateBodySchema, uuid } = require('./common.validator');

const money = (field) => z.coerce.number().min(0, `${field} invalido`);
const dateText = (field) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${field} invalida`);

const facturaBody = z.object({
  empresa_id: uuid('empresa_id'),
  concepto: z.string().trim().min(1, 'concepto es requerido').max(180),
  subtotal: money('subtotal'),
  impuesto: money('impuesto').optional(),
  descuento: money('descuento').optional(),
  fecha_emision: dateText('fecha_emision').optional(),
  fecha_vencimiento: dateText('fecha_vencimiento').optional().nullable(),
  estado: z.enum(['borrador', 'emitida', 'pagada', 'vencida', 'anulada']).optional(),
});

const pagoManualBody = z.object({
  factura_id: uuid('factura_id'),
  monto: money('monto').refine((value) => value > 0, 'monto debe ser mayor a cero'),
  metodo: z.enum(['transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro']).optional(),
  referencia: z.string().trim().max(120).optional().nullable(),
  observacion: z.string().trim().max(500).optional().nullable(),
  comprobante_url: z.string().trim().max(500).optional().nullable(),
});

const listFacturasSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    empresa_id: uuid('empresa_id').optional(),
    estado: z.enum(['borrador', 'emitida', 'pagada', 'vencida', 'anulada']).optional(),
  }),
  params: emptyParams,
});

const listPagosSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    empresa_id: uuid('empresa_id').optional(),
    factura_id: uuid('factura_id').optional(),
    estado: z.enum(['pendiente', 'aprobado', 'rechazado', 'anulado']).optional(),
  }),
  params: emptyParams,
});

const createFacturaSchema = z.object({
  body: facturaBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

const updateFacturaSchema = z.object({
  body: updateBodySchema(facturaBody.omit({ empresa_id: true })),
  query: z.object({}).passthrough(),
  params: idParams,
});

const pagoManualSchema = z.object({
  body: pagoManualBody,
  query: z.object({}).passthrough(),
  params: emptyParams,
});

module.exports = {
  createFacturaSchema,
  idParamSchema,
  listFacturasSchema,
  listPagosSchema,
  pagoManualSchema,
  updateFacturaSchema,
};
