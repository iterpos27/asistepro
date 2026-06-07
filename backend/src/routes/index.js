const { Router } = require('express');

const authRoutes = require('./auth.routes');
const empresaRoutes = require('./empresa.routes');
const facturacionRoutes = require('./facturacion.routes');
const healthRoutes = require('./health.routes');
const planRoutes = require('./plan.routes');
const suscripcionRoutes = require('./suscripcion.routes');
const tenantRoutes = require('./tenant.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/empresas', empresaRoutes);
router.use('/facturacion', facturacionRoutes);
router.use('/health', healthRoutes);
router.use('/planes', planRoutes);
router.use('/suscripciones', suscripcionRoutes);
router.use('/tenant', tenantRoutes);

module.exports = router;
