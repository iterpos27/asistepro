const { Router } = require('express');

const integracionController = require('../controllers/integracion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, featureGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  createIntegrationSchema,
  idParamSchema,
  runIntegrationSchema,
  updateIntegrationSchema,
} = require('../validators/integracion.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);
router.use(featureGuard('integraciones'));

router.get('/', permissionGuard('integraciones', 'ver'), integracionController.list);
router.post('/', permissionGuard('integraciones', 'crear'), validateSchema(createIntegrationSchema), integracionController.create);
router.put('/:id', permissionGuard('integraciones', 'editar'), validateSchema(updateIntegrationSchema), integracionController.update);
router.delete('/:id', permissionGuard('integraciones', 'editar'), validateSchema(idParamSchema), integracionController.remove);
router.post('/:id/run', permissionGuard('integraciones', 'exportar'), validateSchema(runIntegrationSchema), integracionController.run);
router.post('/:id/download', permissionGuard('integraciones', 'exportar'), validateSchema(runIntegrationSchema), integracionController.download);

module.exports = router;
