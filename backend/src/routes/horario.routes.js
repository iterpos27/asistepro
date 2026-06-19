const { Router } = require('express');

const horarioController = require('../controllers/horario.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const { permissionGuard } = require('../utils/granular-permissions.util');
const {
  assignHorarioSchema,
  createHorarioSchema,
  idParamSchema,
  listAsignacionesSchema,
  listHorariosSchema,
  updateHorarioSchema,
} = require('../validators/horario.validator');

const router = Router();

router.use(authGuard);
router.use(roleGuard(['SUPER_ADMIN', 'ADMIN_EMPRESA', 'RRHH']));
router.use(tenantGuard);
router.use(subscriptionGuard);

router.get('/asignaciones', permissionGuard('horarios', 'ver'), validateSchema(listAsignacionesSchema), horarioController.listAsignaciones);
router.post('/asignaciones', permissionGuard('horarios', 'crear'), validateSchema(assignHorarioSchema), horarioController.assignHorario);
router.delete('/asignaciones/:id', permissionGuard('horarios', 'eliminar'), validateSchema(idParamSchema), horarioController.deleteAsignacion);

router.get('/', permissionGuard('horarios', 'ver'), validateSchema(listHorariosSchema), horarioController.listHorarios);
router.post('/', permissionGuard('horarios', 'crear'), validateSchema(createHorarioSchema), horarioController.createHorario);
router.get('/:id', permissionGuard('horarios', 'ver'), validateSchema(idParamSchema), horarioController.getHorario);
router.put('/:id', permissionGuard('horarios', 'editar'), validateSchema(updateHorarioSchema), horarioController.updateHorario);
router.delete('/:id', permissionGuard('horarios', 'eliminar'), validateSchema(idParamSchema), horarioController.deleteHorario);

module.exports = router;
