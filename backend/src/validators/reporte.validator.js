const { z } = require('zod');
const { emptyBody, emptyParams, maybeIsoDate, maybeIsoMonth, paginationQuery, maybeUuid, preprocessEmpty } = require('./common.validator');

const asistenciaEstado = z.enum(['presente', 'ausente']);
const marcacionEstado = z.enum(['aceptada', 'aceptada_con_novedad', 'rechazada']);

const scopedQuery = {
  sucursal_id: maybeUuid('sucursal_id'),
  empleado_id: maybeUuid('empleado_id'),
};

const dateRangeQuery = paginationQuery.extend({
  ...scopedQuery,
  fecha_desde: maybeIsoDate('fecha_desde'),
  fecha_hasta: maybeIsoDate('fecha_hasta'),
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
    fecha: maybeIsoDate('fecha'),
    estado: preprocessEmpty(asistenciaEstado).optional(),
  }),
  params: emptyParams,
});

const asistenciaMensualSchema = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    ...scopedQuery,
    mes: maybeIsoMonth('mes'),
    estado: preprocessEmpty(marcacionEstado).optional(),
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
    fecha: maybeIsoDate('fecha'),
    estado: asistenciaEstado.optional(),
  }),
  params: emptyParams,
});

const exportEntradasSalidasSchema = dateRangeSchema(dateRangeQuery);
const exportNovedadesSchema = dateRangeSchema(dateRangeQuery);
const exportAtrasosSchema = dateRangeSchema(dateRangeQuery);
const exportAsistenciaRangoSchema = dateRangeSchema(
  dateRangeQuery.extend({
    estado: asistenciaEstado.optional(),
  })
);

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
  exportAsistenciaRangoSchema,
  novedadesSchema,
};
