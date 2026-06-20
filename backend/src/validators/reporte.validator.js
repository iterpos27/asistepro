const { z } = require('zod');
const { emptyBody, emptyParams, isoDate, isoMonth, paginationQuery, uuid } = require('./common.validator');

const asistenciaEstado = z.enum(['presente', 'ausente']);
const marcacionEstado = z.enum(['aceptada', 'aceptada_con_novedad', 'rechazada']);

const scopedQuery = {
  sucursal_id: uuid('sucursal_id').optional(),
  empleado_id: uuid('empleado_id').optional(),
};

const dateRangeQuery = paginationQuery.extend({
  ...scopedQuery,
  fecha_desde: isoDate('fecha_desde').optional(),
  fecha_hasta: isoDate('fecha_hasta').optional(),
});

function dateRangeSchema(querySchema = dateRangeQuery) {
  return z
    .object({
      body: emptyBody,
      query: querySchema,
      params: emptyParams,
    })
    .refine(
      ({ query }) =>
        !query.fecha_desde || !query.fecha_hasta || query.fecha_desde <= query.fecha_hasta,
      {
        message: 'fecha_desde no puede ser mayor que fecha_hasta',
        path: ['query', 'fecha_desde'],
      },
    );
}

const asistenciaDiariaSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    ...scopedQuery,
    fecha: isoDate('fecha').optional(),
    estado: asistenciaEstado.optional(),
  }),
  params: emptyParams,
});

const asistenciaMensualSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    ...scopedQuery,
    mes: isoMonth('mes').optional(),
    estado: marcacionEstado.optional(),
  }),
  params: emptyParams,
});

const entradasSalidasSchema = dateRangeSchema();
const novedadesSchema = dateRangeSchema();
const atrasosSchema = dateRangeSchema();
const resumenEjecutivoSchema = dateRangeSchema(dateRangeQuery);

const exportAsistenciaDiariaSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    ...scopedQuery,
    fecha: isoDate('fecha').optional(),
    estado: asistenciaEstado.optional(),
  }),
  params: emptyParams,
});

const exportEntradasSalidasSchema = dateRangeSchema(dateRangeQuery);
const exportNovedadesSchema = dateRangeSchema(dateRangeQuery);
const exportAtrasosSchema = dateRangeSchema(dateRangeQuery);

module.exports = {
  asistenciaDiariaSchema,
  asistenciaMensualSchema,
  atrasosSchema,
  entradasSalidasSchema,
  resumenEjecutivoSchema,
  exportAsistenciaDiariaSchema,
  exportAtrasosSchema,
  exportEntradasSalidasSchema,
  exportNovedadesSchema,
  novedadesSchema,
};
