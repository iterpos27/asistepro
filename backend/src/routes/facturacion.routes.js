const { Router } = require('express');

const facturacionController = require('../controllers/facturacion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authGuard);

router.get('/facturas', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.listFacturas);
router.post('/facturas', roleGuard(['SUPER_ADMIN']), facturacionController.createFactura);
router.get('/facturas/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.getFactura);
router.get('/pagos', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.listPagos);
router.post('/pagos/manual', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), facturacionController.registerManualPayment);

module.exports = router;
