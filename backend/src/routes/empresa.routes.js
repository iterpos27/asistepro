const { Router } = require('express');

const empresaController = require('../controllers/empresa.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createEmpresaSchema,
  idParamSchema,
  listEmpresasSchema,
  updateEmpresaSchema,
  updateMiEmpresaSchema,
} = require('../validators/empresa.validator');

const router = Router();

router.use(authGuard);

router.get('/me', roleGuard(['ADMIN_EMPRESA', 'RRHH', 'EMPLEADO']), empresaController.getMiEmpresa);
router.put('/me', roleGuard(['ADMIN_EMPRESA']), validateSchema(updateMiEmpresaSchema), empresaController.updateMiEmpresa);

router.get('/', roleGuard(['SUPER_ADMIN']), validateSchema(listEmpresasSchema), empresaController.listEmpresas);
router.post('/', roleGuard(['SUPER_ADMIN']), validateSchema(createEmpresaSchema), empresaController.createEmpresa);
router.get('/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(idParamSchema), empresaController.getEmpresa);
router.put('/:id', roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA']), validateSchema(updateEmpresaSchema), empresaController.updateEmpresa);
router.delete('/:id', roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), empresaController.deleteEmpresa);
router.post('/:id/reset-admin-password', roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), empresaController.resetAdminPassword);

module.exports = router;
