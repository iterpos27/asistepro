import { useEffect, useState } from 'react';
import { AlarmClock, CalendarX, Clock3, Download, Lock, TimerReset, Unlock, DollarSign, Star } from 'lucide-react';
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
  const [data, setData] = useState({ resumen: {}, items: [], prenomina: [], cierre: null });
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('jornadas');

  const canClose = user?.permisos?.cierres_mensuales?.cerrar === true;
  const canReopen = user?.permisos?.cierres_mensuales?.reabrir === true;
  const closed = data.cierre?.estado === 'cerrado';
  const periodFinished = month < currentMonth;

  async function load() {
    setLoading(true);
    try {
      const [calculation, list] = await Promise.all([
        service.getCalculo(month),
        service.listCierres()
      ]);
      setData(calculation);
      setClosures(list || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  async function closeMonth() {
    if (!window.confirm(`Cerrar ${month}? Las marcaciones y correcciones quedaran bloqueadas.`)) return;
    await service.cerrarMes(month);
    toast.success('Mes cerrado correctamente');
    await load();
  }

  async function reopenMonth() {
    const reason = window.prompt('Motivo obligatorio para reabrir el mes');
    if (!reason) return;
    await service.reabrirMes(month, reason);
    toast.success('Mes reabierto');
    await load();
  }

  return <>
    <PageHeader
      title="Calculo laboral"
      description="Horas ordinarias, extras, atrasos, ausencias y pre-nómina."
      actions={<>
        <input aria-label="Mes de calculo" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <button className="outline-button" onClick={() => activeTab === 'prenomina' ? service.exportarPrenomina(month) : service.exportarCalculo(month)}>
          <Download size={16} />
          {activeTab === 'prenomina' ? 'Exportar Pre-nómina' : 'Exportar Jornadas'}
        </button>
        {closed && canReopen ? <button className="outline-button" onClick={reopenMonth}><Unlock size={16} />Reabrir</button> : canClose && periodFinished ? <button className="primary-button compact" onClick={closeMonth}><Lock size={16} />Cerrar mes</button> : null}
      </>}
    />
    {closed && <div className="alert-success">Periodo cerrado. El resultado esta congelado desde {new Date(data.cierre.cerrado_en).toLocaleString()}.</div>}

    <section className="metrics-grid">
      <MetricCard label="Horas trabajadas" value={hours(data.resumen.minutos_trabajados)} icon={Clock3} />
      <MetricCard label="Horas extra" value={hours(data.resumen.minutos_extra)} icon={TimerReset} tone="success" />
      <MetricCard label="Atrasos" value={hours(data.resumen.minutos_atraso)} icon={AlarmClock} tone="warning" />
      <MetricCard label="Ausencias" value={data.resumen.ausencias || 0} icon={CalendarX} tone="accent" />
      {(data.resumen.feriados > 0) && <MetricCard label="Feriados" value={data.resumen.feriados || 0} icon={Star} />}
      {(data.resumen.ausencias_justificadas > 0) && <MetricCard label="Justificadas" value={data.resumen.ausencias_justificadas || 0} icon={CalendarX} tone="success" />}
    </section>

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
        Pre-nómina Financiera
      </button>
    </div>

    {activeTab === 'prenomina' ? (
      <div className="panel">
        <PanelTitle title="Pre-nómina Financiera" subtitle={loading ? 'Calculando...' : `${data.prenomina?.length || 0} empleados`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Empleado</th>
                <th>Salario Base</th>
                <th>Ausencias</th>
                <th>Atrasos</th>
                <th>H. Extra</th>
                <th>Dcto. Ausencias</th>
                <th>Dcto. Atrasos</th>
                <th>Pago H. Extra</th>
                <th>Neto a Pagar</th>
              </tr>
            </thead>
            <tbody>
              {data.prenomina?.length ? data.prenomina.map((item, index) => (
                <tr key={`${item.empleado_id}-${index}`}>
                  <td>{item.empleado_codigo}</td>
                  <td>{item.empleado_nombre}</td>
                  <td>{money(item.salario_base)}</td>
                  <td>{item.ausencias} {item.ausencias === 1 ? 'día' : 'días'}</td>
                  <td>{item.minutos_atraso} min</td>
                  <td>{hours(item.minutos_extra)}</td>
                  <td style={{ color: 'var(--accent-color)' }}>-{money(item.descuento_ausencias)}</td>
                  <td style={{ color: 'var(--accent-color)' }}>-{money(item.descuento_atrasos)}</td>
                  <td style={{ color: 'var(--success-color, #10b981)' }}>+{money(item.pago_horas_extra)}</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{money(item.neto_pagar)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center' }}>No hay información de pre-nómina para este mes.</td>
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
                <th>Salida</th>
                <th>Programadas</th>
                <th>Trabajadas</th>
                <th>Extra</th>
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
                  <td>{item.salida?.slice(0, 5) || '-'}</td>
                  <td>{hours(item.minutos_programados)}</td>
                  <td>{hours(item.minutos_trabajados)}</td>
                  <td>{hours(item.minutos_extra)}</td>
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
                  <td colSpan="10">No hay jornadas calculables para este mes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

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
