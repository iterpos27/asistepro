const { Router } = require('express');

const controller = require('../controllers/feriado.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  listFeriadosSchema,
  createFeriadoSchema,
  updateFeriadoSchema,
} = require('../validators/feriado.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', permissionGuard('horarios', 'ver'), validateSchema(listFeriadosSchema), controller.list);
router.post('/', permissionGuard('horarios', 'crear'), validateSchema(createFeriadoSchema), controller.create);
router.put('/:id', permissionGuard('horarios', 'editar'), validateSchema(updateFeriadoSchema), controller.update);
router.delete('/:id', permissionGuard('horarios', 'eliminar'), controller.remove);

module.exports = router;
