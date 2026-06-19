const laboralService = require('../services/laboral.service');
const { toCsv } = require('../utils/csv.util');

const empresaId = (req) => req.tenant.empresa_id;

async function getCalculo(req, res, next) { try { res.json({ ok: true, data: await laboralService.getCalculo({ empresaId: empresaId(req), mes: req.params.mes }) }); } catch (error) { next(error); } }
async function listCierres(req, res, next) { try { res.json({ ok: true, data: await laboralService.listCierres(empresaId(req)) }); } catch (error) { next(error); } }
async function cerrar(req, res, next) { try { res.status(201).json({ ok: true, data: await laboralService.cerrarMes({ empresaId: empresaId(req), mes: req.params.mes, usuarioId: req.auth.usuario_id }) }); } catch (error) { next(error); } }
async function reabrir(req, res, next) { try { res.json({ ok: true, data: await laboralService.reabrirMes({ empresaId: empresaId(req), mes: req.params.mes, usuarioId: req.auth.usuario_id, motivo: req.body.motivo }) }); } catch (error) { next(error); } }
async function exportar(req, res, next) {
  try {
    const data = await laboralService.getCalculo({ empresaId: empresaId(req), mes: req.params.mes });
    const csv = toCsv(data.items, [
      { key: 'fecha', header: 'Fecha' }, { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombre', header: 'Empleado' }, { key: 'horario', header: 'Horario' },
      { key: 'entrada', header: 'Entrada' }, { key: 'salida', header: 'Salida' },
      { key: 'minutos_programados', header: 'Minutos programados' }, { key: 'minutos_trabajados', header: 'Minutos trabajados' },
      { key: 'minutos_ordinarios', header: 'Minutos ordinarios' }, { key: 'minutos_extra', header: 'Minutos extra' },
      { key: 'minutos_atraso', header: 'Minutos atraso' }, { key: 'estado', header: 'Estado' }, { key: 'justificacion', header: 'Justificacion' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="calculo-laboral-${req.params.mes}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
}

module.exports = { cerrar, exportar, getCalculo, listCierres, reabrir };
