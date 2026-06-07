const { Router } = require('express');

const planController = require('../controllers/plan.controller');
const { authGuard, roleGuard } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', authGuard, planController.listPlanes);
router.get('/:id', authGuard, planController.getPlan);
router.post('/', authGuard, roleGuard(['SUPER_ADMIN']), planController.createPlan);
router.put('/:id', authGuard, roleGuard(['SUPER_ADMIN']), planController.updatePlan);
router.delete('/:id', authGuard, roleGuard(['SUPER_ADMIN']), planController.deletePlan);

module.exports = router;
