const integracionService = require('../services/integracion.service');
const tenantService = require('../services/tenant.service');

function getEmpresaId(req) {
  return req.tenant.empresa_id;
}

async function list(req, res, next) {
  try {
    const data = await integracionService.listIntegraciones(getEmpresaId(req));
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    await tenantService.assertIntegrationsCapacity({
      empresaId: getEmpresaId(req),
      plan: req.tenant.subscription,
      includeNew: 1,
    });
    const data = await integracionService.saveIntegracion({
      empresaId: getEmpresaId(req),
      usuarioId: req.auth.usuario_id,
      payload: req.body,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await integracionService.saveIntegracion({
      empresaId: getEmpresaId(req),
      usuarioId: req.auth.usuario_id,
      payload: req.body,
      id: req.params.id,
    });
    if (!data) return res.status(404).json({ ok: false, message: 'Integracion no encontrada' });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const data = await integracionService.deactivateIntegracion(getEmpresaId(req), req.params.id, req.auth.usuario_id);
    if (!data) return res.status(404).json({ ok: false, message: 'Integracion no encontrada' });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function run(req, res, next) {
  try {
    const data = await integracionService.runIntegration({
      empresaId: getEmpresaId(req),
      usuarioId: req.auth.usuario_id,
      id: req.params.id,
      payload: req.body,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
}

async function download(req, res, next) {
  try {
    const file = await integracionService.downloadIntegrationFile({
      empresaId: getEmpresaId(req),
      usuarioId: req.auth.usuario_id,
      id: req.params.id,
      payload: req.body,
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
    return res.send(file.buffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  download,
  list,
  remove,
  run,
  update,
};
