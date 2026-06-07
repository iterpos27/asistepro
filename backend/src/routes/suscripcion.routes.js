const { Router } = require('express');

const suscripcionController = require('../controllers/suscripcion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authGuard);

router.get('/', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), suscripcionController.listSuscripciones);
router.post('/', roleGuard(['SUPER_ADMIN']), suscripcionController.createSuscripcion);
router.get('/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), suscripcionController.getSuscripcion);
router.put('/:id', roleGuard(['SUPER_ADMIN']), suscripcionController.updateSuscripcion);
router.delete('/:id', roleGuard(['SUPER_ADMIN']), suscripcionController.cancelSuscripcion);

module.exports = router;
