const { Router } = require('express');

const reporteController = require('../controllers/reporte.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, featureGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  asistenciaDiariaSchema,
  asistenciaMensualSchema,
  atrasosSchema,
  entradasSalidasSchema,
  exportAsistenciaDiariaSchema,
  exportAtrasosSchema,
  exportEntradasSalidasSchema,
  exportNovedadesSchema,
  novedadesSchema,
} = require('../validators/reporte.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/asistencia-diaria', permissionGuard('reportes', 'ver'), validateSchema(asistenciaDiariaSchema), reporteController.asistenciaDiaria);
router.get('/asistencia-mensual', permissionGuard('reportes', 'ver'), validateSchema(asistenciaMensualSchema), reporteController.asistenciaMensual);
router.get('/entradas-salidas', permissionGuard('reportes', 'ver'), validateSchema(entradasSalidasSchema), reporteController.entradasSalidas);
router.get('/novedades', permissionGuard('reportes', 'ver'), validateSchema(novedadesSchema), reporteController.novedades);
router.get('/atrasos', permissionGuard('reportes', 'ver'), validateSchema(atrasosSchema), reporteController.atrasos);
router.get(
  '/export/asistencia-diaria.csv',
  featureGuard('reportes_avanzados'),
  permissionGuard('reportes', 'exportar'),
  validateSchema(exportAsistenciaDiariaSchema),
  reporteController.exportarAsistenciaDiaria,
);
router.get(
  '/export/entradas-salidas.xls',
  featureGuard('reportes_avanzados'),
  permissionGuard('reportes', 'exportar'),
  validateSchema(exportEntradasSalidasSchema),
  reporteController.exportarEntradasSalidasExcel,
);
router.get(
  '/export/novedades.csv',
  featureGuard('reportes_avanzados'),
  permissionGuard('reportes', 'exportar'),
  validateSchema(exportNovedadesSchema),
  reporteController.exportarNovedades,
);
router.get(
  '/export/atrasos.csv',
  featureGuard('reportes_avanzados'),
  permissionGuard('reportes', 'exportar'),
  validateSchema(exportAtrasosSchema),
  reporteController.exportarAtrasos,
);

module.exports = router;
