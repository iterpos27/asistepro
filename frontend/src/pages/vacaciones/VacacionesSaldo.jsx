import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Edit2, Save, X, Info } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import MetricCard from '../../components/cards/MetricCard';
import * as service from '../../services/vacacionesService';
import { toast } from '../../services/toastService';

const currentYear = new Date().getFullYear();

function SaldoBadge({ value }) {
  const n = Number(value);
  if (n <= 0) return <span className="status-pill danger">{n} días</span>;
  if (n <= 5) return <span className="status-pill warning">{n} días</span>;
  return <span className="status-pill">{n} días</span>;
}

function EmpleadoDetailModal({ empleadoId, onClose }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    service.getVacacionesEmpleado(empleadoId).then(setData).catch(() => toast.error('Error cargando detalle'));
  }, [empleadoId]);

  function startEdit(saldo) {
    setEditing(true);
    setForm({
      anio: saldo.anio,
      saldo_inicial: saldo.saldo_inicial,
      dias_derecho: saldo.dias_derecho,
      dias_tomados: saldo.dias_tomados,
      notas: saldo.notas || '',
    });
  }

  async function save() {
    setSaving(true);
    try {
      await service.updateVacaciones(empleadoId, form);
      toast.success('Saldo actualizado');
      const updated = await service.getVacacionesEmpleado(empleadoId);
      setData(updated);
      setEditing(false);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <p>Cargando...</p>
      </div>
    </div>
  );

  const { empleado, saldo_actual, proyeccion_proximo_anio, historial } = data;
  const disponibles = Number(saldo_actual?.dias_disponibles ?? 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <PanelTitle
          title={`${empleado.nombres} ${empleado.apellidos}`}
          subtitle={`Cód. ${empleado.codigo} · Vacaciones ${currentYear}`}
        />

        {/* Current year summary cards */}
        <section className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
          <MetricCard label="Días derecho" value={saldo_actual?.dias_derecho ?? 0} icon={CalendarDays} />
          <MetricCard label="Saldo inicial" value={saldo_actual?.saldo_inicial ?? 0} icon={CalendarDays} />
          <MetricCard label="Días tomados" value={saldo_actual?.dias_tomados ?? 0} icon={CalendarDays} tone="warning" />
          <MetricCard label="Disponibles" value={Math.max(0, disponibles)} icon={CalendarDays} tone={disponibles <= 0 ? 'accent' : 'success'} />
        </section>

        {/* Next year projection */}
        <div className="panel" style={{ marginBottom: '1rem', background: 'var(--surface-2, #f8fafc)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Info size={18} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>Proyección año {proyeccion_proximo_anio.anio}</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Días por derecho de ley: <strong>{proyeccion_proximo_anio.dias_derecho}</strong> días
                {proyeccion_proximo_anio.saldo_a_favor > 0 && ` + ${proyeccion_proximo_anio.saldo_a_favor} de arrastre del ${currentYear}`}
                {' = '}<strong>{proyeccion_proximo_anio.dias_derecho + proyeccion_proximo_anio.saldo_a_favor} días totales</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Edit current year */}
        {!editing ? (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="outline-button" onClick={() => startEdit(saldo_actual)}>
              <Edit2 size={15} /> Ajustar saldo {currentYear}
            </button>
          </div>
        ) : (
          <div className="panel" style={{ marginBottom: '1rem' }}>
            <PanelTitle title="Ajuste manual de saldo" subtitle="Solo para correcciones de RRHH" />
            <div className="form-grid">
              <label>
                Saldo inicial (días acumulados previos)
                <input type="number" step="0.5" min="0" value={form.saldo_inicial}
                  onChange={(e) => setForm((f) => ({ ...f, saldo_inicial: e.target.value }))} />
              </label>
              <label>
                Días por derecho de ley
                <input type="number" step="0.5" min="0" value={form.dias_derecho}
                  onChange={(e) => setForm((f) => ({ ...f, dias_derecho: e.target.value }))} />
              </label>
              <label>
                Días ya tomados
                <input type="number" step="0.5" min="0" value={form.dias_tomados}
                  onChange={(e) => setForm((f) => ({ ...f, dias_tomados: e.target.value }))} />
              </label>
              <label>
                Notas internas
                <input type="text" value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Observaciones del ajuste..." />
              </label>
            </div>
            <div className="form-actions">
              <button className="outline-button" onClick={() => setEditing(false)} disabled={saving}><X size={15} /> Cancelar</button>
              <button className="primary-button compact" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        )}

        {/* History */}
        {historial.length > 1 && (
          <div className="table-wrap">
            <PanelTitle title="Historial por año" subtitle="Todos los años registrados" />
            <table>
              <thead>
                <tr><th>Año</th><th>Derecho</th><th>Inicial</th><th>Tomados</th><th>Disponible</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.anio}>
                    <td><strong>{h.anio}</strong></td>
                    <td>{h.dias_derecho}</td>
                    <td>{h.saldo_inicial}</td>
                    <td>{h.dias_tomados}</td>
                    <td><SaldoBadge value={h.dias_disponibles} /></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.notas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button className="outline-button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function VacacionesSaldo() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [anio, setAnio] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const result = await service.listVacaciones({ anio });
      setData(result || { items: [], total: 0 });
    } catch {
      toast.error('Error cargando saldos de vacaciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [anio]);

  const items = data.items || [];
  // Summary stats
  const totalDisponibles = items.reduce((s, i) => s + Math.max(0, Number(i.dias_disponibles)), 0);
  const sinSaldo = items.filter((i) => Number(i.dias_disponibles) <= 0).length;
  const conSaldo = items.filter((i) => Number(i.dias_disponibles) > 0).length;

  return (
    <>
      <PageHeader
        title="Control de Vacaciones"
        description="Saldos de días de vacaciones por empleado. Se actualiza automáticamente al aprobar solicitudes."
        actions={
          <select value={anio} onChange={(e) => setAnio(e.target.value)} style={{ width: '110px' }}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        }
      />

      <section className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <MetricCard label="Empleados" value={items.length} icon={CalendarDays} />
        <MetricCard label="Con días disponibles" value={conSaldo} icon={CalendarDays} tone="success" />
        <MetricCard label="Sin saldo" value={sinSaldo} icon={CalendarDays} tone="accent" />
        <MetricCard label="Total días acumulados" value={totalDisponibles} icon={CalendarDays} />
      </section>

      {selectedId && (
        <EmpleadoDetailModal empleadoId={selectedId} onClose={() => { setSelectedId(null); load(); }} />
      )}

      <div className="panel">
        <PanelTitle title={`Saldos de vacaciones — ${anio}`} subtitle={loading ? 'Cargando...' : `${items.length} empleados activos`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Cargo</th>
                <th>Ingreso</th>
                <th>Derecho (ley)</th>
                <th>Saldo inicial</th>
                <th>Tomados</th>
                <th>Disponibles</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((item) => {
                const disponibles = Math.max(0, Number(item.dias_disponibles));
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.empleado_nombres} {item.empleado_apellidos}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.empleado_codigo}</div>
                    </td>
                    <td>{item.cargo || '-'}</td>
                    <td>{item.fecha_ingreso ? new Date(item.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-EC') : '-'}</td>
                    <td style={{ textAlign: 'center' }}><strong>{item.dias_derecho}</strong></td>
                    <td style={{ textAlign: 'center' }}>{item.saldo_inicial}</td>
                    <td style={{ textAlign: 'center' }}>{item.dias_tomados}</td>
                    <td style={{ textAlign: 'center' }}><SaldoBadge value={disponibles} /></td>
                    <td>
                      <button className="icon-button" title="Ver detalle" onClick={() => setSelectedId(item.empleado_id)}>
                        <ChevronDown size={16} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8} style={{ textAlign: 'center' }}>
                  {loading ? 'Cargando...' : 'No hay empleados activos para este año.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
