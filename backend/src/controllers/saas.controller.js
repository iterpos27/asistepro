const saasService = require('../services/saas.service');

async function overview(req, res, next) {
  try {
    const data = await saasService.getOverview();
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function tenants(req, res, next) {
  try {
    const data = await saasService.listTenants();
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  overview,
  tenants,
};
