import { useEffect, useState } from 'react';
import { AlarmClock, AlertTriangle, CalendarX, Clock3, Download, Lock, Save, Settings, TimerReset, Unlock, DollarSign, Star } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import * as service from '../../services/laboralService';
import { toast } from '../../services/toastService';

const currentMonth = new Date().toISOString().slice(0, 7);
function hours(minutes) { return `${(Number(minutes || 0) / 60).toFixed(2)} h`; }
function money(val) { return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0); }

export default function CalculoLaboral() {
  const { user } = useAuthContext();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState({ resumen: {}, items: [], prenomina: [], servicios_profesionales: [], alertas: [], cierre: null });
  const [closures, setClosures] = useState([]);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [activeTab, setActiveTab] = useState('jornadas');

  const canClose = user?.permisos?.cierres_mensuales?.cerrar === true;
  const canReopen = user?.permisos?.cierres_mensuales?.reabrir === true;
  const canEditRules = user?.permisos?.calculo_laboral?.editar === true;
  const closed = data.cierre?.estado === 'cerrado';
  const periodFinished = month < currentMonth;
  const alertas = data.alertas || [];

  async function load() {
    setLoading(true);
    try {
      const [calculation, list, companyRules] = await Promise.all([
        service.getCalculo(month),
        service.listCierres(),
        service.getReglasLaborales()
      ]);
      setData(calculation);
      setClosures(list || []);
      setRules(companyRules || calculation.reglas || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  async function closeMonth() {
    const critical = alertas.filter(item => item.nivel === 'critica').length;
    const warningText = critical ? `\n\nHay ${critical} alerta(s) critica(s) antes del cierre.` : '';
    if (!window.confirm(`Cerrar ${month}? Las marcaciones y correcciones quedaran bloqueadas.${warningText}`)) return;
    await service.cerrarMes(month);
    toast.success('Mes cerrado correctamente');
    await load();
  }

  async function saveRules() {
    setSavingRules(true);
    try {
      const saved = await service.updateReglasLaborales(rules);
      setRules(saved);
      toast.success('Reglas laborales actualizadas');
      await load();
    } finally {
      setSavingRules(false);
    }
  }

  function updateRule(key, value) {
    setRules(prev => ({ ...(prev || {}), [key]: value }));
  }

  async function reopenMonth() {
    const reason = window.prompt('Motivo obligatorio para reabrir el mes');
    if (!reason) return;
    await service.reabrirMes(month, reason);
    toast.success('Mes reabierto');
    await load();
  }

  function printMonthlySheet(employeeId, employeeName, employeeCodigo) {
    const empItems = (data.items || []).filter(item => item.empleado_id === employeeId).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const printWindow = window.open('', '_blank');
    
    let rowsHtml = empItems.map(item => `
      <tr>
        <td>${item.fecha}</td>
        <td>${item.horario || '-'}</td>
        <td>${item.entrada?.slice(0, 5) || '-'}</td>
        <td>${item.salida_almuerzo?.slice(0, 5) || '-'}</td>
        <td>${item.entrada_almuerzo?.slice(0, 5) || '-'}</td>
        <td>${item.salida?.slice(0, 5) || '-'}</td>
        <td>${hours(item.minutos_programados)}</td>
        <td>${hours(item.minutos_trabajados)}</td>
        <td>${hours(item.minutos_suplementarias || 0)}</td>
        <td>${hours(item.minutos_extraordinarias || 0)}</td>
        <td>${item.minutos_atraso || 0} min</td>
        <td>${item.estado} ${item.justificacion ? `(${item.justificacion})` : ''}</td>
      </tr>
    `).join('');

    const totalTrabajadas = hours(empItems.reduce((acc, item) => acc + item.minutos_trabajados, 0));
    const totalSupl = hours(empItems.reduce((acc, item) => acc + (item.minutos_suplementarias || 0), 0));
    const totalExtra = hours(empItems.reduce((acc, item) => acc + (item.minutos_extraordinarias || 0), 0));
    const totalAtrasos = empItems.reduce((acc, item) => acc + item.minutos_atraso, 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Hoja de Asistencia Mensual - ${employeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 5px 0; font-size: 20px; }
            .header p { margin: 2px 0; color: #666; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .info-item { font-size: 14px; }
            .info-item strong { color: #111; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .summary { margin-bottom: 40px; font-size: 13px; }
            .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
            .signature-box { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; }
            @media print {
              body { margin: 15px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <h1>HOJA DE ASISTENCIA MENSUAL</h1>
            <p>ASISTEPRO - CONTROL DE ASISTENCIA Y PERSONAL</p>
          </div>
          <div class="info-grid">
            <div class="info-item"><strong>Empleado:</strong> ${employeeName}</div>
            <div class="info-item"><strong>Código:</strong> ${employeeCodigo}</div>
            <div class="info-item"><strong>Periodo (Mes):</strong> ${month}</div>
            <div class="info-item"><strong>Empresa:</strong> ${user?.empresa_nombre || 'AsistePro Tenant'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Entrada</th>
                <th>Salida almuerzo</th>
                <th>Entrada almuerzo</th>
                <th>Salida</th>
                <th>Prog.</th>
                <th>Trabaj.</th>
                <th>H. Supl (50%)</th>
                <th>H. Extra (100%)</th>
                <th>Atraso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="summary">
            <strong>Resumen del Periodo:</strong>
            <ul>
              <li>Total Horas Trabajadas: ${totalTrabajadas}</li>
              <li>Total Horas Suplementarias (50%): ${totalSupl}</li>
              <li>Total Horas Extraordinarias (100%): ${totalExtra}</li>
              <li>Total Minutos de Atraso: ${totalAtrasos} min</li>
            </ul>
          </div>
          <div class="signatures">
            <div class="signature-box">Firma del Empleado</div>
            <div class="signature-box">Talento Humano / Supervisor</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return <>
    <PageHeader
      title="Calculo laboral"
      description="Horas ordinarias, extras, atrasos, ausencias, cierres mensuales y resumen financiero laboral."
      actions={<>
        <input aria-label="Mes de calculo" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <button className="outline-button" onClick={() => activeTab === 'prenomina' ? service.exportarPrenomina(month) : service.exportarCalculo(month)}>
          <Download size={16} />
          {activeTab === 'prenomina' ? 'Exportar resumen' : 'Exportar jornadas'}
        </button>
        <button className="outline-button" onClick={() => service.exportarResumenContable(month)}>
          <Download size={16} />
          Exportar contable
        </button>
        {closed && canReopen ? <button className="outline-button" onClick={reopenMonth}><Unlock size={16} />Reabrir</button> : canClose && periodFinished ? <button className="primary-button compact" onClick={closeMonth}><Lock size={16} />Cerrar mes</button> : null}
      </>}
    />
    {closed && <div className="alert-success">Periodo cerrado. El resultado esta congelado desde {new Date(data.cierre.cerrado_en).toLocaleString()}.</div>}

    <section className="metrics-grid">
      <MetricCard label="Horas trabajadas" value={hours(data.resumen.minutos_trabajados)} icon={Clock3} />
      <MetricCard label="Horas extra" value={hours(data.resumen.minutos_extra)} icon={TimerReset} tone="success" />
      <MetricCard label="Nocturnas" value={hours(data.resumen.minutos_nocturnos)} icon={Clock3} tone="accent" />
      <MetricCard label="Atrasos" value={hours(data.resumen.minutos_atraso)} icon={AlarmClock} tone="warning" />
      <MetricCard label="Ausencias" value={data.resumen.ausencias || 0} icon={CalendarX} tone="accent" />
      {(data.resumen.alertas_criticas > 0) && <MetricCard label="Alertas criticas" value={data.resumen.alertas_criticas || 0} icon={AlertTriangle} tone="warning" />}
      {(data.resumen.feriados > 0) && <MetricCard label="Feriados" value={data.resumen.feriados || 0} icon={Star} />}
      {(data.resumen.ausencias_justificadas > 0) && <MetricCard label="Justificadas" value={data.resumen.ausencias_justificadas || 0} icon={CalendarX} tone="success" />}
      {(data.resumen.servicios_profesionales > 0) && <MetricCard label="Bajo factura" value={data.resumen.servicios_profesionales || 0} icon={DollarSign} tone="accent" />}
    </section>

    {rules ? (
      <div className="panel">
        <PanelTitle title="Reglas laborales por empresa" subtitle="Base de calculo, almuerzo, recargos y ausencias pagadas." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
          <label>Horas base mes<input type="number" step="0.01" value={rules.base_calculo_mensual_horas ?? ''} disabled={!canEditRules} onChange={e => updateRule('base_calculo_mensual_horas', e.target.value)} /></label>
          <label>Dias base mes<input type="number" step="0.01" value={rules.dias_base_mes ?? ''} disabled={!canEditRules} onChange={e => updateRule('dias_base_mes', e.target.value)} /></label>
          <label>Tolerancia atraso<input type="number" value={rules.tolerancia_atraso_minutos ?? ''} disabled={!canEditRules} onChange={e => updateRule('tolerancia_atraso_minutos', e.target.value)} /></label>
          <label>Almuerzo min<input type="number" value={rules.almuerzo_minutos ?? ''} disabled={!canEditRules} onChange={e => updateRule('almuerzo_minutos', e.target.value)} /></label>
          <label>Almuerzo desde<input type="time" value={rules.almuerzo_inicio ?? '12:00'} disabled={!canEditRules} onChange={e => updateRule('almuerzo_inicio', e.target.value)} /></label>
          <label>Almuerzo hasta<input type="time" value={rules.almuerzo_fin ?? '15:00'} disabled={!canEditRules} onChange={e => updateRule('almuerzo_fin', e.target.value)} /></label>
          <label>Nocturna desde<input type="time" value={rules.hora_inicio_nocturna ?? '19:00'} disabled={!canEditRules} onChange={e => updateRule('hora_inicio_nocturna', e.target.value)} /></label>
          <label>Nocturna hasta<input type="time" value={rules.hora_fin_nocturna ?? '06:00'} disabled={!canEditRules} onChange={e => updateRule('hora_fin_nocturna', e.target.value)} /></label>
          <label>Recargo supl.<input type="number" step="0.01" value={rules.recargo_suplementaria ?? ''} disabled={!canEditRules} onChange={e => updateRule('recargo_suplementaria', e.target.value)} /></label>
          <label>Recargo extra<input type="number" step="0.01" value={rules.recargo_extraordinaria ?? ''} disabled={!canEditRules} onChange={e => updateRule('recargo_extraordinaria', e.target.value)} /></label>
          <label>Recargo noct.<input type="number" step="0.01" value={rules.recargo_nocturna ?? ''} disabled={!canEditRules} onChange={e => updateRule('recargo_nocturna', e.target.value)} /></label>
          <label>Recargo feriado<input type="number" step="0.01" value={rules.recargo_feriado ?? ''} disabled={!canEditRules} onChange={e => updateRule('recargo_feriado', e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <input type="checkbox" checked={rules.descontar_almuerzo_automatico !== false} disabled={!canEditRules} onChange={e => updateRule('descontar_almuerzo_automatico', e.target.checked)} />
            Descontar almuerzo automatico
          </label>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <input type="checkbox" checked={rules.ausencia_permiso_pagado !== false} disabled={!canEditRules} onChange={e => updateRule('ausencia_permiso_pagado', e.target.checked)} />
            Permiso pagado
          </label>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <input type="checkbox" checked={rules.ausencia_incapacidad_pagada !== false} disabled={!canEditRules} onChange={e => updateRule('ausencia_incapacidad_pagada', e.target.checked)} />
            Incapacidad pagada
          </label>
          {canEditRules ? <button className="primary-button compact" onClick={saveRules} disabled={savingRules}><Save size={16} />{savingRules ? 'Guardando...' : 'Guardar reglas'}</button> : <span className="status-pill"><Settings size={14} />Solo lectura</span>}
        </div>
      </div>
    ) : null}

    {alertas.length ? (
      <div className="panel">
        <PanelTitle title="Alertas antes de cerrar" subtitle={`${data.resumen.alertas_criticas || 0} criticas · ${data.resumen.alertas_advertencia || 0} advertencias · ${data.resumen.alertas_info || 0} informativas`} />
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          {alertas.slice(0, 12).map((alerta, index) => (
            <div key={`${alerta.codigo}-${index}`} className={alerta.nivel === 'critica' ? 'alert-error' : 'alert-success'} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              ...(alerta.nivel === 'advertencia' ? { background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' } : {})
            }}>
              <AlertTriangle size={18} />
              <span>{alerta.mensaje}</span>
            </div>
          ))}
          {alertas.length > 12 ? <div className="status-pill">+{alertas.length - 12} alertas adicionales en exportacion</div> : null}
        </div>
      </div>
    ) : null}

    <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
      <button
        className={`tab-btn ${activeTab === 'jornadas' ? 'active' : ''}`}
        onClick={() => setActiveTab('jornadas')}
        style={{
          background: 'none',
          border: 'none',
          borderBottom: activeTab === 'jornadas' ? '3px solid var(--primary-color)' : '3px solid transparent',
          padding: '0.5rem 1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          color: activeTab === 'jornadas' ? 'var(--primary-color)' : 'var(--text-muted)'
        }}
      >
        Detalle de Jornadas
      </button>
      <button
        className={`tab-btn ${activeTab === 'prenomina' ? 'active' : ''}`}
        onClick={() => setActiveTab('prenomina')}
        style={{
          background: 'none',
          border: 'none',
          borderBottom: activeTab === 'prenomina' ? '3px solid var(--primary-color)' : '3px solid transparent',
          padding: '0.5rem 1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          color: activeTab === 'prenomina' ? 'var(--primary-color)' : 'var(--text-muted)'
        }}
      >
        Resumen financiero
      </button>
    </div>

    {activeTab === 'prenomina' ? (
      <div className="panel">
        <PanelTitle title="Resumen financiero laboral" subtitle={loading ? 'Calculando...' : `${data.prenomina?.length || 0} empleados`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Empleado</th>
                <th>Salario Base</th>
                <th>Justificadas</th>
                <th>No justificadas</th>
                <th>Ausencias</th>
                <th>Atrasos</th>
                <th>H. Supl (50%)</th>
                <th>H. Extra (100%)</th>
                <th>Nocturnas</th>
                <th>Feriados</th>
                <th>Dcto. Ausencias</th>
                <th>Dcto. Atrasos</th>
                <th>Pago Supl</th>
                <th>Pago Extra</th>
                <th>Pago Noct.</th>
                <th>Pago Feriado</th>
                <th>Ingresos</th>
                <th>Descuentos</th>
                <th>Neto a Pagar</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.prenomina?.length ? data.prenomina.map((item, index) => (
                <tr key={`${item.empleado_id}-${index}`}>
                  <td>{item.empleado_codigo}</td>
                  <td>{item.empleado_nombre}</td>
                  <td>{money(item.salario_base)}</td>
                  <td>{item.ausencias_justificadas || 0}</td>
                  <td>{item.ausencias_no_justificadas || 0}</td>
                  <td>{item.ausencias} {item.ausencias === 1 ? 'día' : 'días'}</td>
                  <td>{item.minutos_atraso} min</td>
                  <td>{hours(item.minutos_suplementarias || 0)}</td>
                  <td>{hours(item.minutos_extraordinarias || 0)}</td>
                  <td>{hours(item.minutos_nocturnos || 0)}</td>
                  <td>{hours(item.minutos_feriado || 0)}</td>
                  <td style={{ color: 'var(--accent-color)' }}>-{money(item.descuento_ausencias)}</td>
                  <td style={{ color: 'var(--accent-color)' }}>-{money(item.descuento_atrasos)}</td>
                  <td style={{ color: 'var(--success-color, #10b981)' }}>+{money(item.pago_suplementarias || 0)}</td>
                  <td style={{ color: 'var(--success-color, #10b981)' }}>+{money(item.pago_extraordinarias || 0)}</td>
                  <td style={{ color: 'var(--success-color, #10b981)' }}>+{money(item.pago_nocturnas || 0)}</td>
                  <td style={{ color: 'var(--success-color, #10b981)' }}>+{money(item.pago_feriados || 0)}</td>
                  <td>{money(item.total_ingresos || 0)}</td>
                  <td>{money(item.total_descuentos || 0)}</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{money(item.neto_pagar)}</td>
                  <td>
                    <button
                      className="outline-button compact"
                      onClick={() => printMonthlySheet(item.empleado_id, item.empleado_nombre, item.empleado_codigo)}
                      title="Imprimir Hoja de Asistencia Mensual"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      Imprimir Hoja
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="21" style={{ textAlign: 'center' }}>No hay resumen financiero para este mes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <div className="panel">
        <PanelTitle title="Detalle diario" subtitle={loading ? 'Calculando...' : `${data.items?.length || 0} jornadas`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Horario</th>
                <th>Entrada</th>
                <th>Salida almuerzo</th>
                <th>Entrada almuerzo</th>
                <th>Salida</th>
                <th>Programadas</th>
                <th>Trabajadas</th>
                <th>H. Supl (50%)</th>
                <th>H. Extra (100%)</th>
                <th>Nocturna</th>
                <th>Feriado</th>
                <th>Atraso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.length ? data.items.map((item, index) => (
                <tr key={`${item.empleado_id}-${item.fecha}-${index}`}>
                  <td>{item.fecha}</td>
                  <td>{item.empleado_codigo} - {item.empleado_nombre}</td>
                  <td>{item.horario || '-'}</td>
                  <td>{item.entrada?.slice(0, 5) || '-'}</td>
                  <td>{item.salida_almuerzo?.slice(0, 5) || '-'}</td>
                  <td>{item.entrada_almuerzo?.slice(0, 5) || '-'}</td>
                  <td>{item.salida?.slice(0, 5) || '-'}</td>
                  <td>{hours(item.minutos_programados)}</td>
                  <td>{hours(item.minutos_trabajados)}</td>
                  <td>{hours(item.minutos_suplementarias || 0)}</td>
                  <td>{hours(item.minutos_extraordinarias || 0)}</td>
                  <td>{hours(item.minutos_nocturnos || 0)}</td>
                  <td>{hours(item.minutos_feriado || 0)}</td>
                  <td>{item.minutos_atraso} min</td>
                  <td>
                    <span className={`status-pill ${
                      item.estado === 'ausente' ? 'danger' :
                      item.estado === 'incompleta' ? 'warning' :
                      item.estado === 'feriado' ? 'info' :
                      item.estado === 'justificada' ? 'success' :
                      ''
                    }`} style={
                      item.estado === 'feriado' ? { background: '#dbeafe', color: '#1d4ed8', borderColor: '#93c5fd' } :
                      item.estado === 'justificada' ? { background: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' } : {}
                    }>
                      {item.estado}{item.justificacion ? ` (${item.justificacion})` : ''}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="15">No hay jornadas calculables para este mes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {data.servicios_profesionales?.length ? (
      <div className="panel">
        <PanelTitle title="Servicios profesionales / bajo factura" subtitle="Control operativo de asistencia separado del resumen financiero laboral." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Persona</th>
                <th>Contrato</th>
                <th>Jornadas</th>
                <th>Horas registradas</th>
                <th>Atrasos registrados</th>
              </tr>
            </thead>
            <tbody>
              {data.servicios_profesionales.map((item) => (
                <tr key={item.empleado_id}>
                  <td>{item.empleado_codigo}</td>
                  <td>{item.empleado_nombre}</td>
                  <td>{item.tipo_contrato}</td>
                  <td>{item.jornadas}</td>
                  <td>{hours(item.minutos_trabajados)}</td>
                  <td>{item.minutos_atraso || 0} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null}

    <div className="panel">
      <PanelTitle title="Historial de cierres" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Estado</th>
              <th>Cerrado por</th>
              <th>Fecha cierre</th>
              <th>Reapertura</th>
            </tr>
          </thead>
          <tbody>
            {closures.length ? closures.map(item => (
              <tr key={item.id}>
                <td>{item.mes}</td>
                <td><span className="status-pill">{item.estado}</span></td>
                <td>{item.cerrado_por_nombre} {item.cerrado_por_apellido}</td>
                <td>{new Date(item.cerrado_en).toLocaleString()}</td>
                <td>{item.motivo_reapertura || '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5">No hay cierres registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}
