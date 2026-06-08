const { Router } = require('express');

const reporteController = require('../controllers/reporte.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/asistencia-diaria', reporteController.asistenciaDiaria);
router.get('/asistencia-mensual', reporteController.asistenciaMensual);
router.get('/novedades', reporteController.novedades);
router.get('/atrasos', reporteController.atrasos);
router.get('/export/asistencia-diaria.csv', reporteController.exportarAsistenciaDiaria);
router.get('/export/novedades.csv', reporteController.exportarNovedades);
router.get('/export/atrasos.csv', reporteController.exportarAtrasos);

module.exports = router;
