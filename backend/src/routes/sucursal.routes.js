const { Router } = require('express');

const sucursalController = require('../controllers/sucursal.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createSucursalSchema,
  idParamSchema,
  updateSucursalSchema,
} = require('../validators/sucursal.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', sucursalController.listSucursales);
router.post('/', validateSchema(createSucursalSchema), sucursalController.createSucursal);
router.get('/:id', validateSchema(idParamSchema), sucursalController.getSucursal);
router.put('/:id', validateSchema(updateSucursalSchema), sucursalController.updateSucursal);
router.delete('/:id', validateSchema(idParamSchema), sucursalController.deleteSucursal);
router.get('/:id/qr', validateSchema(idParamSchema), sucursalController.getQr);
router.post('/:id/qr/dynamic', validateSchema(idParamSchema), sucursalController.issueDynamicQr);
router.post('/:id/qr/rotate', validateSchema(idParamSchema), sucursalController.rotateQr);

module.exports = router;
