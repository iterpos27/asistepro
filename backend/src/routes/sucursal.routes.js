const { Router } = require('express');

const sucursalController = require('../controllers/sucursal.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, planLimitGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  createSucursalSchema,
  idParamSchema,
  listSucursalesSchema,
  updateSucursalSchema,
} = require('../validators/sucursal.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', permissionGuard('sucursales', 'ver'), validateSchema(listSucursalesSchema), sucursalController.listSucursales);
router.post('/', permissionGuard('sucursales', 'crear'), validateSchema(createSucursalSchema), planLimitGuard('sucursales'), sucursalController.createSucursal);
router.get('/:id', permissionGuard('sucursales', 'ver'), validateSchema(idParamSchema), sucursalController.getSucursal);
router.put('/:id', permissionGuard('sucursales', 'editar'), validateSchema(updateSucursalSchema), sucursalController.updateSucursal);
router.delete('/:id', permissionGuard('sucursales', 'eliminar'), validateSchema(idParamSchema), sucursalController.deleteSucursal);
router.get('/:id/qr', permissionGuard('sucursales', 'ver'), validateSchema(idParamSchema), sucursalController.getQr);
router.post('/:id/qr/dynamic', permissionGuard('sucursales', 'editar'), validateSchema(idParamSchema), sucursalController.issueDynamicQr);
router.post('/:id/qr/rotate', permissionGuard('sucursales', 'editar'), validateSchema(idParamSchema), sucursalController.rotateQr);

module.exports = router;
