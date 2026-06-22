const { Router } = require('express');

const suscripcionController = require('../controllers/suscripcion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createSuscripcionSchema,
  idParamSchema,
  listSuscripcionesSchema,
  updateSuscripcionSchema,
} = require('../validators/suscripcion.validator');

const router = Router();

router.use(authGuard);

router.get('/', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(listSuscripcionesSchema), suscripcionController.listSuscripciones);
router.post('/', roleGuard(['SUPER_ADMIN']), validateSchema(createSuscripcionSchema), suscripcionController.createSuscripcion);
router.get('/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(idParamSchema), suscripcionController.getSuscripcion);
router.put('/:id', roleGuard(['SUPER_ADMIN']), validateSchema(updateSuscripcionSchema), suscripcionController.updateSuscripcion);
router.delete('/:id', roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), suscripcionController.cancelSuscripcion);

module.exports = router;
