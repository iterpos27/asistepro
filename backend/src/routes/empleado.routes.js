const { Router } = require('express');

const empleadoController = require('../controllers/empleado.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, planLimitGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
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

router.get('/', permissionGuard('empleados', 'ver'), validateSchema(listEmpleadosSchema), empleadoController.listEmpleados);
router.post('/', permissionGuard('empleados', 'crear'), validateSchema(createEmpleadoSchema), planLimitGuard('empleados'), empleadoController.createEmpleado);
router.get('/:id', permissionGuard('empleados', 'ver'), validateSchema(idParamSchema), empleadoController.getEmpleado);
router.put('/:id', permissionGuard('empleados', 'editar'), validateSchema(updateEmpleadoSchema), empleadoController.updateEmpleado);
router.patch('/:id/liberar-dispositivo', permissionGuard('empleados', 'editar'), validateSchema(idParamSchema), empleadoController.liberarDispositivo);
router.delete('/:id', permissionGuard('empleados', 'eliminar'), validateSchema(idParamSchema), empleadoController.deleteEmpleado);

module.exports = router;
