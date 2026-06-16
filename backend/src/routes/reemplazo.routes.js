const { Router } = require('express');

const reemplazoController = require('../controllers/reemplazo.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, featureGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createReemplazoSchema,
  idParamSchema,
  listReemplazosSchema,
  updateReemplazoSchema,
} = require('../validators/reemplazo.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);
router.use(featureGuard('reemplazos'));

router.get('/', validateSchema(listReemplazosSchema), reemplazoController.listReemplazos);
router.post('/', validateSchema(createReemplazoSchema), reemplazoController.createReemplazo);
router.get('/:id', validateSchema(idParamSchema), reemplazoController.getReemplazo);
router.put('/:id', validateSchema(updateReemplazoSchema), reemplazoController.updateReemplazo);
router.delete('/:id', validateSchema(idParamSchema), reemplazoController.cancelReemplazo);

module.exports = router;
