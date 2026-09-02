const { Router } = require('express');

const integracionController = require('../controllers/integracion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, featureGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  createIntegrationSchema,
  idParamSchema,
  runIntegrationSchema,
  updateIntegrationSchema,
  biometricUsersSchema,
  biometricLinkSchema,
} = require('../validators/integracion.validator');

const router = Router();
const admsInbox = require('../services/adms-inbox.service');
const admsAction = (action) => async (req, res, next) => {
  try {
    const data = await action({ empresaId: req.tenant.empresa_id, usuarioId: req.auth.usuario_id,
      id: req.params.id, body: req.body, query: req.query });
    res.json({ ok: true, data });
  } catch (error) { next(error); }
};

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);
router.use(featureGuard('integraciones'));

router.get('/', permissionGuard('integraciones', 'ver'), integracionController.list);
router.get('/:id/adms', permissionGuard('integraciones', 'ver'), validateSchema(idParamSchema), admsAction(admsInbox.list));
router.post('/:id/adms/registro', permissionGuard('integraciones', 'editar'), validateSchema(idParamSchema), admsAction(admsInbox.register));
router.post('/:id/adms/piloto', permissionGuard('integraciones', 'editar'), permissionGuard('integraciones', 'exportar'), validateSchema(idParamSchema), admsAction(admsInbox.uploadPilot));
router.post('/:id/adms/importar', permissionGuard('integraciones', 'editar'), permissionGuard('integraciones', 'exportar'), validateSchema(idParamSchema), admsAction(admsInbox.importEvent));
router.get('/:id/usuarios-biometrico', permissionGuard('integraciones', 'ver'), validateSchema(biometricUsersSchema), integracionController.listBiometricUsers);
router.post('/:id/usuarios-biometrico/vincular', permissionGuard('integraciones', 'editar'), permissionGuard('integraciones', 'exportar'), validateSchema(biometricLinkSchema), integracionController.linkBiometricUser);
router.post('/', permissionGuard('integraciones', 'crear'), validateSchema(createIntegrationSchema), integracionController.create);
router.put('/:id', permissionGuard('integraciones', 'editar'), validateSchema(updateIntegrationSchema), integracionController.update);
router.delete('/:id', permissionGuard('integraciones', 'editar'), validateSchema(idParamSchema), integracionController.remove);
router.post('/:id/run', permissionGuard('integraciones', 'exportar'), validateSchema(runIntegrationSchema), integracionController.run);
router.post('/:id/download', permissionGuard('integraciones', 'exportar'), validateSchema(runIntegrationSchema), integracionController.download);

module.exports = router;
