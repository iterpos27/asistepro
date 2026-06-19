const { Router } = require('express');

const organizacionController = require('../controllers/organizacion.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard, featureGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  createStructureSchema,
  idParamSchema,
  importEmployeesSchema,
  listStructuresSchema,
  updateStructureSchema,
} = require('../validators/organizacion.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);
router.use(featureGuard('organizacion'));

router.get('/summary', permissionGuard('organizacion', 'ver'), organizacionController.summary);
router.get('/catalogos', permissionGuard('organizacion', 'ver'), organizacionController.catalogs);
router.get('/estructuras', permissionGuard('organizacion', 'ver'), validateSchema(listStructuresSchema), organizacionController.listStructures);
router.post('/estructuras', permissionGuard('organizacion', 'crear'), validateSchema(createStructureSchema), organizacionController.createStructure);
router.put('/estructuras/:id', permissionGuard('organizacion', 'editar'), validateSchema(updateStructureSchema), organizacionController.updateStructure);
router.delete('/estructuras/:id', permissionGuard('organizacion', 'eliminar'), validateSchema(idParamSchema), organizacionController.deleteStructure);
router.get('/importaciones', permissionGuard('importaciones', 'ver'), organizacionController.listImports);
router.post('/importaciones/empleados', permissionGuard('importaciones', 'crear'), featureGuard('importaciones'), validateSchema(importEmployeesSchema), organizacionController.importEmployees);

module.exports = router;
