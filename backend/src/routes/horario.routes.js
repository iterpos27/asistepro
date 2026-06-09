const { Router } = require('express');

const horarioController = require('../controllers/horario.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
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

router.get('/asignaciones', validateSchema(listAsignacionesSchema), horarioController.listAsignaciones);
router.post('/asignaciones', validateSchema(assignHorarioSchema), horarioController.assignHorario);
router.delete('/asignaciones/:id', validateSchema(idParamSchema), horarioController.deleteAsignacion);

router.get('/', validateSchema(listHorariosSchema), horarioController.listHorarios);
router.post('/', validateSchema(createHorarioSchema), horarioController.createHorario);
router.get('/:id', validateSchema(idParamSchema), horarioController.getHorario);
router.put('/:id', validateSchema(updateHorarioSchema), horarioController.updateHorario);
router.delete('/:id', validateSchema(idParamSchema), horarioController.deleteHorario);

module.exports = router;
