const { Router } = require('express');

const saasController = require('../controllers/saas.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN']));

router.get('/overview', permissionGuard('saas_consumo', 'ver'), saasController.overview);
router.get('/tenants', permissionGuard('saas_consumo', 'ver'), saasController.tenants);

module.exports = router;
