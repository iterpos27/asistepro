const { Router } = require('express');

const tenantController = require('../controllers/tenant.controller');
const { authGuard } = require('../middlewares/auth.middleware');
const {
  tenantGuard,
  subscriptionGuard,
} = require('../middlewares/tenant.middleware');

const router = Router();

router.get('/context', authGuard, tenantGuard, subscriptionGuard, tenantController.getTenantContext);

module.exports = router;
