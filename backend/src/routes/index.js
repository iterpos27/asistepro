const { Router } = require('express');

const authRoutes = require('./auth.routes');
const empleadoRoutes = require('./empleado.routes');
const empresaRoutes = require('./empresa.routes');
const facturacionRoutes = require('./facturacion.routes');
const healthRoutes = require('./health.routes');
const planRoutes = require('./plan.routes');
const suscripcionRoutes = require('./suscripcion.routes');
const sucursalRoutes = require('./sucursal.routes');
const tenantRoutes = require('./tenant.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/empleados', empleadoRoutes);
router.use('/empresas', empresaRoutes);
router.use('/facturacion', facturacionRoutes);
router.use('/health', healthRoutes);
router.use('/planes', planRoutes);
router.use('/suscripciones', suscripcionRoutes);
router.use('/sucursales', sucursalRoutes);
router.use('/tenant', tenantRoutes);

module.exports = router;
