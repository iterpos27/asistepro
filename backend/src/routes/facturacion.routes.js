const { Router } = require('express');

const facturacionController = require('../controllers/facturacion.controller');
const stripeController = require('../controllers/stripe.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createFacturaSchema,
  idParamSchema,
  listFacturasSchema,
  listPagosSchema,
  pagoManualSchema,
  updateFacturaSchema,
  checkoutSimuladoSchema,
} = require('../validators/facturacion.validator');

const router = Router();

router.get('/cron-check', facturacionController.triggerCronCheck);
router.post('/stripe/webhook', stripeController.handleWebhook);

router.use(authGuard);

router.get('/facturas', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(listFacturasSchema), facturacionController.listFacturas);
router.post('/facturas', roleGuard(['SUPER_ADMIN']), validateSchema(createFacturaSchema), facturacionController.createFactura);
router.get('/facturas/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(idParamSchema), facturacionController.getFactura);
router.get('/facturas/:id/pdf', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(idParamSchema), facturacionController.getFacturaPdf);
router.put('/facturas/:id', roleGuard(['SUPER_ADMIN']), validateSchema(updateFacturaSchema), facturacionController.updateFactura);
router.delete('/facturas/:id', roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), facturacionController.anularFactura);
router.get('/pagos', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(listPagosSchema), facturacionController.listPagos);
router.get('/pagos/:id/comprobante', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(idParamSchema), facturacionController.getPagoComprobante);
router.get('/pagos/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(idParamSchema), facturacionController.getPago);
router.post('/pagos/manual', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(pagoManualSchema), facturacionController.registerManualPayment);
router.post('/checkout-simulado', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(checkoutSimuladoSchema), facturacionController.checkoutSimulado);
router.post('/stripe/create-checkout-session', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), stripeController.createCheckoutSession);
router.post('/pagos/:id/aprobar', roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), facturacionController.aprobarPago);
router.delete('/pagos/:id', roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), facturacionController.anularPago);

module.exports = router;
