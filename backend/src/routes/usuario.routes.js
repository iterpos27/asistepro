const { Router } = require('express');

const usuarioController = require('../controllers/usuario.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { assignRoleSchema, roleSchema, updateRoleSchema } = require('../validators/usuario.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/permisos', usuarioController.listPermisos);
router.get('/roles-personalizados', usuarioController.listRoles);
router.post('/roles-personalizados', validateSchema(roleSchema), usuarioController.createRol);
router.put('/roles-personalizados/:id', validateSchema(updateRoleSchema), usuarioController.updateRol);
router.put('/:id/rol-personalizado', validateSchema(assignRoleSchema), usuarioController.assignRol);
router.put('/:id/permisos', usuarioController.updatePermisos);

module.exports = router;
