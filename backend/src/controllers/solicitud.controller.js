const service = require('../services/solicitud.service');
const { parsePagination } = require('../utils/pagination.util');
const empresaId = (req) => req.tenant.empresa_id;
async function list(req, res, next) { try { const { limit, offset } = parsePagination(req.query, { maxLimit: 200 }); res.json({ ok: true, data: await service.listSolicitudes({ empresaId: empresaId(req), auth: req.auth, estado: req.query.estado, tipo: req.query.tipo, empleadoId: req.query.empleado_id, limit, offset }) }); } catch (error) { next(error); } }
async function create(req, res, next) { try { res.status(201).json({ ok: true, data: await service.createSolicitud({ empresaId: empresaId(req), auth: req.auth, payload: req.body }) }); } catch (error) { next(error); } }
async function review(req, res, next) { try { res.json({ ok: true, data: await service.reviewSolicitud({ empresaId: empresaId(req), solicitudId: req.params.id, reviewerId: req.auth.usuario_id, decision: req.body.decision, comentario: req.body.comentario }) }); } catch (error) { next(error); } }
async function cancel(req, res, next) { try { res.json({ ok: true, data: await service.cancelSolicitud({ empresaId: empresaId(req), solicitudId: req.params.id, auth: req.auth }) }); } catch (error) { next(error); } }
async function catalogs(req, res, next) { try { res.json({ ok: true, data: await service.getCatalogs({ empresaId: empresaId(req), auth: req.auth }) }); } catch (error) { next(error); } }
module.exports = { cancel, catalogs, create, list, review };
