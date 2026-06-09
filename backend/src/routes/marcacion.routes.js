const { Router } = require('express');

const marcacionController = require('../controllers/marcacion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { marcacionSchema } = require('../validators/marcacion.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH', 'EMPLEADO']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', marcacionController.listMarcaciones);
router.post('/', validateSchema(marcacionSchema), marcacionController.registrarMarcacion);
router.get('/:id', marcacionController.getMarcacion);

module.exports = router;
