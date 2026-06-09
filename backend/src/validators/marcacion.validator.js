const { z } = require('zod');

const marcacionSchema = z.object({
  body: z.object({
    qr_token: z.string().trim().min(1, 'qr_token es requerido'),
    tipo: z.enum(['entrada', 'salida'], { message: 'tipo debe ser entrada o salida' }),
    empleado_id: z.uuid('empleado_id invalido').optional(),
    latitud: z.coerce.number().min(-90, 'latitud invalida').max(90, 'latitud invalida'),
    longitud: z.coerce.number().min(-180, 'longitud invalida').max(180, 'longitud invalida'),
    precision_gps: z.coerce.number().nonnegative('precision_gps invalida').optional(),
    accuracy: z.coerce.number().nonnegative('accuracy invalida').optional(),
    motivo_novedad: z
      .enum(['Reemplazo', 'Apoyo temporal', 'Emergencia', 'Autorizacion supervisor', 'Otro'])
      .optional(),
    detalle_novedad: z.string().trim().optional().nullable(),
    marcado_en: z.string().trim().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

module.exports = {
  marcacionSchema,
};
