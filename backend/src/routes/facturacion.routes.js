const { Router } = require('express');

const facturacionController = require('../controllers/facturacion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authGuard);

router.get('/facturas', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.listFacturas);
router.post('/facturas', roleGuard(['SUPER_ADMIN']), facturacionController.createFactura);
router.get('/facturas/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.getFactura);
router.put('/facturas/:id', roleGuard(['SUPER_ADMIN']), facturacionController.updateFactura);
router.delete('/facturas/:id', roleGuard(['SUPER_ADMIN']), facturacionController.anularFactura);
router.get('/pagos', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.listPagos);
router.get('/pagos/:id/comprobante', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.getPagoComprobante);
router.get('/pagos/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.getPago);
router.post('/pagos/manual', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.registerManualPayment);
router.post('/pagos/:id/aprobar', roleGuard(['SUPER_ADMIN']), facturacionController.aprobarPago);
router.delete('/pagos/:id', roleGuard(['SUPER_ADMIN']), facturacionController.anularPago);

module.exports = router;
