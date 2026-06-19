const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const { authGuard } = require('../middlewares/auth.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { changePasswordSchema, registerTenantSchema } = require('../validators/auth.validator');

const router = Router();

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/register-tenant', validateSchema(registerTenantSchema), authController.registerTenant);
router.get('/me', authGuard, authController.me);
router.put('/password', authGuard, validateSchema(changePasswordSchema), authController.changePassword);

module.exports = router;
