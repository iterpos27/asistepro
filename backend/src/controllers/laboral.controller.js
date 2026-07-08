const laboralService = require('../services/laboral.service');
const { toCsv } = require('../utils/csv.util');

const empresaId = (req) => req.tenant.empresa_id;

async function getCalculo(req, res, next) { try { res.json({ ok: true, data: await laboralService.getCalculo({ empresaId: empresaId(req), mes: req.params.mes }) }); } catch (error) { next(error); } }
async function getReglas(req, res, next) { try { res.json({ ok: true, data: await laboralService.getReglasLaborales(empresaId(req)) }); } catch (error) { next(error); } }
async function updateReglas(req, res, next) { try { res.json({ ok: true, data: await laboralService.updateReglasLaborales(empresaId(req), req.body) }); } catch (error) { next(error); } }
async function getAlertas(req, res, next) { try { res.json({ ok: true, data: await laboralService.getAlertas({ empresaId: empresaId(req), mes: req.params.mes }) }); } catch (error) { next(error); } }
async function listCierres(req, res, next) { try { res.json({ ok: true, data: await laboralService.listCierres(empresaId(req)) }); } catch (error) { next(error); } }
async function cerrar(req, res, next) { try { res.status(201).json({ ok: true, data: await laboralService.cerrarMes({ empresaId: empresaId(req), mes: req.params.mes, usuarioId: req.auth.usuario_id }) }); } catch (error) { next(error); } }
async function reabrir(req, res, next) { try { res.json({ ok: true, data: await laboralService.reabrirMes({ empresaId: empresaId(req), mes: req.params.mes, usuarioId: req.auth.usuario_id, motivo: req.body.motivo }) }); } catch (error) { next(error); } }
async function exportar(req, res, next) {
  try {
    const data = await laboralService.getCalculo({ empresaId: empresaId(req), mes: req.params.mes });
    const csv = toCsv(data.items, [
      { key: 'fecha', header: 'Fecha' }, { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombre', header: 'Empleado' }, { key: 'horario', header: 'Horario' },
      { key: 'entrada', header: 'Entrada' }, { key: 'salida_almuerzo', header: 'Salida almuerzo' },
      { key: 'entrada_almuerzo', header: 'Entrada almuerzo' }, { key: 'salida', header: 'Salida' },
      { key: 'minutos_programados', header: 'Minutos programados' }, { key: 'minutos_trabajados', header: 'Minutos trabajados' },
      { key: 'minutos_ordinarios', header: 'Minutos ordinarios' }, { key: 'minutos_extra', header: 'Minutos extra' },
      { key: 'minutos_suplementarias', header: 'Minutos suplementarias' }, { key: 'minutos_extraordinarias', header: 'Minutos extraordinarias' },
      { key: 'minutos_nocturnos', header: 'Minutos nocturnos' }, { key: 'minutos_feriado', header: 'Minutos feriado' },
      { key: 'minutos_ausencia_justificada', header: 'Minutos ausencia justificada' }, { key: 'minutos_ausencia_no_justificada', header: 'Minutos ausencia no justificada' },
      { key: 'minutos_atraso', header: 'Minutos atraso' }, { key: 'estado', header: 'Estado' }, { key: 'justificacion', header: 'Justificacion' },
      { key: 'ausencia_pagada', header: 'Ausencia pagada' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="calculo-laboral-${req.params.mes}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
}

async function exportarPrenomina(req, res, next) {
  try {
    const data = await laboralService.getCalculo({ empresaId: empresaId(req), mes: req.params.mes });
    const csv = toCsv(data.prenomina, [
      { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombre', header: 'Empleado' },
      { key: 'salario_base', header: 'Salario Base' },
      { key: 'valor_hora', header: 'Valor Hora' },
      { key: 'ausencias', header: 'Ausencias' },
      { key: 'ausencias_justificadas', header: 'Ausencias Justificadas' },
      { key: 'ausencias_no_justificadas', header: 'Ausencias No Justificadas' },
      { key: 'dias_pagados', header: 'Dias Pagados' },
      { key: 'dias_no_pagados', header: 'Dias No Pagados' },
      { key: 'minutos_atraso', header: 'Minutos Atraso' },
      { key: 'minutos_extra', header: 'Minutos Extra' },
      { key: 'minutos_nocturnos', header: 'Minutos Nocturnos' },
      { key: 'minutos_feriado', header: 'Minutos Feriado' },
      { key: 'descuento_ausencias', header: 'Descuento Ausencias' },
      { key: 'descuento_atrasos', header: 'Descuento Atrasos' },
      { key: 'pago_suplementarias', header: 'Pago Suplementarias' },
      { key: 'pago_extraordinarias', header: 'Pago Extraordinarias' },
      { key: 'pago_nocturnas', header: 'Pago Nocturnas' },
      { key: 'pago_feriados', header: 'Pago Feriados' },
      { key: 'total_ingresos', header: 'Total Ingresos' },
      { key: 'total_descuentos', header: 'Total Descuentos' },
      { key: 'neto_pagar', header: 'Neto a Pagar' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resumen-financiero-laboral-${req.params.mes}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
}

async function exportarResumenContable(req, res, next) {
  try {
    const data = await laboralService.getCalculo({ empresaId: empresaId(req), mes: req.params.mes });
    const rows = data.prenomina.map((item) => ({
      ...item,
      periodo: req.params.mes,
      alertas_criticas: data.resumen?.alertas_criticas || 0,
      alertas_advertencia: data.resumen?.alertas_advertencia || 0,
    }));
    const csv = toCsv(rows, [
      { key: 'periodo', header: 'Periodo' },
      { key: 'empleado_codigo', header: 'Codigo' },
      { key: 'empleado_nombre', header: 'Empleado' },
      { key: 'salario_base', header: 'Salario Base' },
      { key: 'valor_hora', header: 'Valor Hora' },
      { key: 'dias_pagados', header: 'Dias Pagados' },
      { key: 'dias_no_pagados', header: 'Dias No Pagados' },
      { key: 'minutos_suplementarias', header: 'Minutos Suplementarias' },
      { key: 'minutos_extraordinarias', header: 'Minutos Extraordinarias' },
      { key: 'minutos_nocturnos', header: 'Minutos Nocturnos' },
      { key: 'minutos_feriado', header: 'Minutos Feriado' },
      { key: 'descuento_ausencias', header: 'Descuento Ausencias' },
      { key: 'descuento_atrasos', header: 'Descuento Atrasos' },
      { key: 'pago_suplementarias', header: 'Pago Suplementarias' },
      { key: 'pago_extraordinarias', header: 'Pago Extraordinarias' },
      { key: 'pago_nocturnas', header: 'Pago Nocturnas' },
      { key: 'pago_feriados', header: 'Pago Feriados' },
      { key: 'total_ingresos', header: 'Total Ingresos' },
      { key: 'total_descuentos', header: 'Total Descuentos' },
      { key: 'neto_pagar', header: 'Neto a Pagar' },
      { key: 'alertas_criticas', header: 'Alertas Criticas Mes' },
      { key: 'alertas_advertencia', header: 'Alertas Advertencia Mes' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resumen-contable-laboral-${req.params.mes}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
}

module.exports = { cerrar, exportar, exportarPrenomina, exportarResumenContable, getAlertas, getCalculo, getReglas, listCierres, reabrir, updateReglas };
