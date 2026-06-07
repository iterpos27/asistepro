const { Router } = require('express');

const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const tenantRoutes = require('./tenant.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/tenant', tenantRoutes);

module.exports = router;
