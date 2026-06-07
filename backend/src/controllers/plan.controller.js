const planService = require('../services/plan.service');

async function listPlanes(req, res, next) {
  try {
    const planes = await planService.listPlanes({
      incluirInactivos: req.query.incluir_inactivos === 'true',
    });

    res.json({ ok: true, data: planes });
  } catch (error) {
    next(error);
  }
}

async function getPlan(req, res, next) {
  try {
    const plan = await planService.findPlanById(req.params.id);

    if (!plan) {
      return res.status(404).json({ ok: false, message: 'Plan no encontrado' });
    }

    return res.json({ ok: true, data: plan });
  } catch (error) {
    return next(error);
  }
}

async function createPlan(req, res, next) {
  try {
    const plan = await planService.createPlan(req.body);
    return res.status(201).json({ ok: true, data: plan });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe un plan con ese codigo';
    }

    return next(error);
  }
}

async function updatePlan(req, res, next) {
  try {
    const plan = await planService.updatePlan(req.params.id, req.body);

    if (!plan) {
      return res.status(404).json({ ok: false, message: 'Plan no encontrado' });
    }

    return res.json({ ok: true, data: plan });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Ya existe un plan con ese codigo';
    }

    return next(error);
  }
}

async function deletePlan(req, res, next) {
  try {
    const plan = await planService.deactivatePlan(req.params.id);

    if (!plan) {
      return res.status(404).json({ ok: false, message: 'Plan no encontrado' });
    }

    return res.json({ ok: true, data: plan });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPlanes,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
};
