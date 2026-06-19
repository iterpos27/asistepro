const { Router } = require('express');

const notificacionController = require('../controllers/notificacion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { idParamSchema, listNotificacionesSchema, subscribePushSchema } = require('../validators/notificacion.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH', 'EMPLEADO']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/', validateSchema(listNotificacionesSchema), notificacionController.listNotificaciones);
router.post('/subscribe', validateSchema(subscribePushSchema), notificacionController.subscribePush);
router.put('/read-all', notificacionController.markAllAsRead);
router.put('/:id/read', validateSchema(idParamSchema), notificacionController.markAsRead);

module.exports = router;
