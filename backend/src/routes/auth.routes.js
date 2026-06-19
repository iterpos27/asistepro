const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const { authGuard } = require('../middlewares/auth.middleware');
const { loginRateLimit, registerRateLimit } = require('../middlewares/auth-rate-limit.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { changePasswordSchema, registerTenantSchema } = require('../validators/auth.validator');

const router = Router();

router.post('/login', loginRateLimit, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/register-tenant', registerRateLimit, validateSchema(registerTenantSchema), authController.registerTenant);
router.get('/me', authGuard, authController.me);
router.put('/password', authGuard, validateSchema(changePasswordSchema), authController.changePassword);

module.exports = router;
