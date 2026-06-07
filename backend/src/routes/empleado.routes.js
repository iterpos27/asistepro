const { Router } = require('express');

const empleadoController = require('../controllers/empleado.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', empleadoController.listEmpleados);
router.post('/', empleadoController.createEmpleado);
router.get('/:id', empleadoController.getEmpleado);
router.put('/:id', empleadoController.updateEmpleado);
router.delete('/:id', empleadoController.deleteEmpleado);

module.exports = router;
