const usuarioService = require('../services/usuario.service');

async function listPermisos(req, res, next) {
  try {
    const result = await usuarioService.listUsuariosPermisos({
      empresaId: req.tenant.empresa_id,
      actorRole: req.auth.rol,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function updatePermisos(req, res, next) {
  try {
    const result = await usuarioService.updateUsuarioPermisos({
      empresaId: req.tenant.empresa_id,
      actorRole: req.auth.rol,
      usuarioId: req.params.id,
      modulos: req.body.modulos || {},
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function listRoles(req, res, next) { try { res.json({ ok: true, data: await usuarioService.listRolesPersonalizados(req.tenant.empresa_id) }); } catch (error) { next(error); } }
async function createRol(req, res, next) { try { res.status(201).json({ ok: true, data: await usuarioService.saveRolPersonalizado({ empresaId: req.tenant.empresa_id, usuarioId: req.auth.usuario_id, payload: req.body }) }); } catch (error) { next(error); } }
async function updateRol(req, res, next) { try { res.json({ ok: true, data: await usuarioService.saveRolPersonalizado({ empresaId: req.tenant.empresa_id, usuarioId: req.auth.usuario_id, id: req.params.id, payload: req.body }) }); } catch (error) { next(error); } }
async function assignRol(req, res, next) { try { res.json({ ok: true, data: await usuarioService.assignRolPersonalizado({ empresaId: req.tenant.empresa_id, actorRole: req.auth.rol, usuarioId: req.params.id, rolPersonalizadoId: req.body.rol_personalizado_id, permisos: req.body.permisos }) }); } catch (error) { next(error); } }

module.exports = {
  listPermisos,
  updatePermisos,
  assignRol,
  createRol,
  listRoles,
  updateRol,
};
