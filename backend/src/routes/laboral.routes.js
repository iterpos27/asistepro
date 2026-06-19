const { Router } = require('express');
const controller = require('../controllers/laboral.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const { validateSchema } = require('../middlewares/validation.middleware');
const { monthParamSchema, reopenSchema } = require('../validators/laboral.validator');

const router = Router();
router.use(authGuard, roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']), tenantGuard, subscriptionGuard);
router.get('/cierres', permissionGuard('cierres_mensuales', 'ver'), controller.listCierres);
router.get('/:mes/export', permissionGuard('calculo_laboral', 'exportar'), validateSchema(monthParamSchema), controller.exportar);
router.get('/:mes', permissionGuard('calculo_laboral', 'ver'), validateSchema(monthParamSchema), controller.getCalculo);
router.post('/:mes/cerrar', permissionGuard('cierres_mensuales', 'cerrar'), validateSchema(monthParamSchema), controller.cerrar);
router.post('/:mes/reabrir', permissionGuard('cierres_mensuales', 'reabrir'), validateSchema(reopenSchema), controller.reabrir);

module.exports = router;
