const { Router } = require('express');
const controller = require('../controllers/vacaciones.controller');
const { authGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');

const router = Router();

router.use(authGuard, tenantGuard, subscriptionGuard);

// List all employees' vacation balances
router.get('/', permissionGuard('vacaciones', 'ver'), controller.list);

// Get full vacation info for one employee (current year + projection + history)
router.get('/:empleadoId', permissionGuard('vacaciones', 'ver'), controller.getEmpleado);

// HR manual adjustment of a balance record
router.put('/:empleadoId', permissionGuard('vacaciones', 'editar'), controller.update);

module.exports = router;
