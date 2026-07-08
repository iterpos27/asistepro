const { Router } = require('express');
const controller = require('../controllers/laboral.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const { validateSchema } = require('../middlewares/validation.middleware');
const { monthParamSchema, reglasSchema, reopenSchema } = require('../validators/laboral.validator');

const router = Router();
router.use(authGuard, roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']), tenantGuard, subscriptionGuard);
router.get('/cierres', permissionGuard('cierres_mensuales', 'ver'), controller.listCierres);
router.get('/reglas', permissionGuard('calculo_laboral', 'ver'), controller.getReglas);
router.put('/reglas', permissionGuard('calculo_laboral', 'editar'), validateSchema(reglasSchema), controller.updateReglas);
router.get('/:mes/alertas', permissionGuard('calculo_laboral', 'ver'), validateSchema(monthParamSchema), controller.getAlertas);
router.get('/:mes/export-resumen-contable', permissionGuard('calculo_laboral', 'exportar'), validateSchema(monthParamSchema), controller.exportarResumenContable);
router.get('/:mes/export-prenomina', permissionGuard('calculo_laboral', 'exportar'), validateSchema(monthParamSchema), controller.exportarPrenomina);
router.get('/:mes/export', permissionGuard('calculo_laboral', 'exportar'), validateSchema(monthParamSchema), controller.exportar);
router.get('/:mes', permissionGuard('calculo_laboral', 'ver'), validateSchema(monthParamSchema), controller.getCalculo);
router.post('/:mes/cerrar', permissionGuard('cierres_mensuales', 'cerrar'), validateSchema(monthParamSchema), controller.cerrar);
router.post('/:mes/reabrir', permissionGuard('cierres_mensuales', 'reabrir'), validateSchema(reopenSchema), controller.reabrir);

module.exports = router;
