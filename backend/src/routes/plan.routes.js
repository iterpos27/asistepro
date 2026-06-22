const { Router } = require('express');

const planController = require('../controllers/plan.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');
const { validateSchema } = require('../middlewares/validation.middleware');
const {
  createPlanSchema,
  idParamSchema,
  listPlanesSchema,
  updatePlanSchema,
} = require('../validators/plan.validator');

const router = Router();

router.get('/', authGuard, validateSchema(listPlanesSchema), planController.listPlanes);
router.get('/public', validateSchema(listPlanesSchema), planController.listPlanes);
router.get('/:id', authGuard, validateSchema(idParamSchema), planController.getPlan);
router.post('/', authGuard, roleGuard(['SUPER_ADMIN']), validateSchema(createPlanSchema), planController.createPlan);
router.put('/:id', authGuard, roleGuard(['SUPER_ADMIN']), validateSchema(updatePlanSchema), planController.updatePlan);
router.delete('/:id', authGuard, roleGuard(['SUPER_ADMIN']), validateSchema(idParamSchema), planController.deletePlan);

module.exports = router;
