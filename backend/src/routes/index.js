const { Router } = require('express');

const authRoutes = require('./auth.routes');
const empleadoRoutes = require('./empleado.routes');
const empresaRoutes = require('./empresa.routes');
const facturacionRoutes = require('./facturacion.routes');
const healthRoutes = require('./health.routes');
const horarioRoutes = require('./horario.routes');
const marcacionRoutes = require('./marcacion.routes');
const planRoutes = require('./plan.routes');
const reporteRoutes = require('./reporte.routes');
const reemplazoRoutes = require('./reemplazo.routes');
const notificacionRoutes = require('./notificacion.routes');
const suscripcionRoutes = require('./suscripcion.routes');
const sucursalRoutes = require('./sucursal.routes');
const tenantRoutes = require('./tenant.routes');
const usuarioRoutes = require('./usuario.routes');
const laboralRoutes = require('./laboral.routes');
const solicitudRoutes = require('./solicitud.routes');
const auditoriaRoutes = require('./auditoria.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/empleados', empleadoRoutes);
router.use('/empresas', empresaRoutes);
router.use('/facturacion', facturacionRoutes);
router.use('/health', healthRoutes);
router.use('/horarios', horarioRoutes);
router.use('/marcaciones', marcacionRoutes);
router.use('/planes', planRoutes);
router.use('/reportes', reporteRoutes);
router.use('/reemplazos', reemplazoRoutes);
router.use('/notificaciones', notificacionRoutes);
router.use('/suscripciones', suscripcionRoutes);
router.use('/sucursales', sucursalRoutes);
router.use('/tenant', tenantRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/laboral', laboralRoutes);
router.use('/solicitudes', solicitudRoutes);
router.use('/auditoria', auditoriaRoutes);

module.exports = router;
