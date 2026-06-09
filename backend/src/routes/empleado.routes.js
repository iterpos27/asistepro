const { Router } = require('express');

const empleadoController = require('../controllers/empleado.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createEmpleadoSchema,
  idParamSchema,
  listEmpleadosSchema,
  updateEmpleadoSchema,
} = require('../validators/empleado.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', validateSchema(listEmpleadosSchema), empleadoController.listEmpleados);
router.post('/', validateSchema(createEmpleadoSchema), empleadoController.createEmpleado);
router.get('/:id', validateSchema(idParamSchema), empleadoController.getEmpleado);
router.put('/:id', validateSchema(updateEmpleadoSchema), empleadoController.updateEmpleado);
router.delete('/:id', validateSchema(idParamSchema), empleadoController.deleteEmpleado);

module.exports = router;
