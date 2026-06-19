const service = require('../services/auditoria.service');
const { parsePagination } = require('../utils/pagination.util');
const { toCsv } = require('../utils/csv.util');
function params(req, limit, offset) { return { empresaId: req.tenant.empresa_id, usuarioId: req.query.usuario_id, entidad: req.query.entidad, metodo: req.query.metodo, fechaDesde: req.query.fecha_desde, fechaHasta: req.query.fecha_hasta, search: req.query.search, limit, offset }; }
async function list(req,res,next) { try { const page=parsePagination(req.query,{maxLimit:200}); res.json({ok:true,data:await service.list(params(req,page.limit,page.offset))}); } catch(error){next(error);} }
async function exportar(req,res,next) { try { const data=await service.list(params(req,5000,0)); const csv=toCsv(data.items,[{key:'creado_en',header:'Fecha'},{key:'usuario_email',header:'Usuario'},{key:'accion',header:'Accion'},{key:'entidad',header:'Entidad'},{key:'metodo',header:'Metodo'},{key:'ruta',header:'Ruta'},{key:'ip',header:'IP'},{key:'estado_http',header:'HTTP'}]); res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="auditoria.csv"');res.send(csv);}catch(error){next(error);} }
module.exports={exportar,list};
