import { useEffect, useState } from 'react';
import { CalendarPlus, Edit, Plus, RotateCcw, Search, Trash2, Calendar, ChevronLeft, ChevronRight, Grid, List } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as horarioService from '../../services/horarioService';
import { toast } from '../../services/toastService';
import * as sucursalService from '../../services/sucursalService';
import * as empleadoService from '../../services/empleadoService';
import HorarioForm from './HorarioForm';

const dayLabels = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mie',
  4: 'Jue',
  5: 'Vie',
  6: 'Sab',
  7: 'Dom',
};

function daysText(days = []) {
  return days.map((day) => dayLabels[day] || day).join(', ');
}

function timeOnly(value) {
  if (!value) return '-';
  return String(value).slice(0, 5);
}

function formatDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HorariosList() {
  const [horarios, setHorarios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [activo, setActivo] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [selectedHorario, setSelectedHorario] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [pendingDeleteAsignacion, setPendingDeleteAsignacion] = useState(null);
  const [assignment, setAssignment] = useState({ empleado_id: '', horario_id: '', fecha_inicio: '', fecha_fin: '' });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  
  // Matriz visual states
  const [activeTab, setActiveTab] = useState('matriz');
  const [selectedHorarioForQuickAssign, setSelectedHorarioForQuickAssign] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return formatDateString(monday);
  });

  const weekDates = (() => {
    const dates = [];
    const baseDate = new Date(currentWeekStart + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d);
    }
    return dates;
  })();

  function toggleEmployeeSelection(empId) {
    setSelectedEmployeeIds((current) =>
      current.includes(empId) ? current.filter((id) => id !== empId) : [...current, empId]
    );
  }

  function toggleSelectAll(filteredList) {
    const filteredIds = filteredList.map((emp) => emp.id);
    const allSelected = filteredIds.every((id) => selectedEmployeeIds.includes(id));

    if (allSelected) {
      setSelectedEmployeeIds((current) => current.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedEmployeeIds((current) => {
        const next = [...current];
        filteredIds.forEach((id) => {
          if (!next.includes(id)) {
            next.push(id);
          }
        });
        return next;
      });
    }
  }

  async function loadSucursales() {
    const result = await sucursalService.listSucursales({ limit: 100 });
    setSucursales(result.items || []);
  }

  async function loadEmpleados() {
    try {
      const result = await empleadoService.listEmpleados({ estado: 'activo', limit: 150 });
      setEmpleados(result.items || []);
    } catch {
      setEmpleados([]);
    }
  }

  async function loadHorarios() {
    setLoading(true);
    setError('');

    try {
      const result = await horarioService.listHorarios({
        search,
        activo,
        sucursalId,
        limit: 100,
      });
      setHorarios(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los horarios');
    } finally {
      setLoading(false);
    }
  }

  async function loadAsignaciones() {
    try {
      const result = await horarioService.listAsignaciones({ activo: 'true', limit: 200 });
      setAsignaciones(result.items || []);
    } catch {
      setAsignaciones([]);
    }
  }

  async function saveAssignment(event) {
    event.preventDefault();
    if (!selectedEmployeeIds.length) {
      toast.error('Debe seleccionar al menos un empleado');
      return;
    }
    setAssignLoading(true);
    setError('');
    setMessage('');

    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    for (const empId of selectedEmployeeIds) {
      try {
        await horarioService.assignHorario({
          empleado_id: empId,
          horario_id: assignment.horario_id,
          fecha_inicio: assignment.fecha_inicio || undefined,
          fecha_fin: assignment.fecha_fin || undefined,
        });
        successCount++;
      } catch (requestError) {
        failCount++;
        lastError = requestError.response?.data?.message || requestError.message;
      }
    }

    if (successCount > 0) {
      toast.success(`Horario asignado a ${successCount} empleados correctamente.`);
    }
    if (failCount > 0) {
      toast.error(`Error al asignar a ${failCount} empleados: ${lastError}`);
    }

    if (successCount > 0) {
      setShowAssignForm(false);
      setSelectedEmployeeIds([]);
      setEmployeeSearch('');
      await loadAsignaciones();
    } else {
      setAssignLoading(false);
    }
  }

  async function removeAssignment(asignacion) {
    setError('');
    setMessage('');

    try {
      await horarioService.deleteAsignacion(asignacion.id);
      setMessage('Asignacion eliminada correctamente');
      toast.success('Asignacion eliminada correctamente');
      setPendingDeleteAsignacion(null);
      await loadAsignaciones();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo eliminar la asignacion');
    }
  }

  useEffect(() => {
    loadSucursales().catch((requestError) => {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las sucursales');
    });
    loadHorarios();
    loadAsignaciones();
    loadEmpleados();
  }, []);

  function openCreateForm() {
    setSelectedHorario(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(horario) {
    setSelectedHorario(horario);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedHorario(null);
    setShowForm(false);
  }

  function openAssignForm(horario = null) {
    if (!empleados.length) {
      loadEmpleados();
    }

    setAssignment({
      empleado_id: '',
      horario_id: horario?.id || horarios.find((item) => item.activo)?.id || '',
      fecha_inicio: formatDateString(new Date()),
      fecha_fin: '',
    });
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
    setShowAssignForm(true);
    setMessage('');
    setError('');
  }

  function closeAssignForm() {
    setShowAssignForm(false);
    setAssignment({ empleado_id: '', horario_id: '', fecha_inicio: '', fecha_fin: '' });
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
  }

  async function saveHorario(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedHorario) {
        await horarioService.updateHorario(selectedHorario.id, values);
        setMessage('Horario actualizado correctamente');
        toast.success('Horario actualizado correctamente');
      } else {
        await horarioService.createHorario(values);
        setMessage('Horario creado correctamente');
        toast.success('Horario creado correctamente');
      }

      closeForm();
      await loadHorarios();
      await loadAsignaciones();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar el horario');
    } finally {
      setFormLoading(false);
    }
  }

  async function deactivateHorario(horario) {
    setMessage('');
    setError('');

    try {
      await horarioService.deleteHorario(horario.id);
      setMessage('Horario desactivado correctamente');
      toast.success('Horario desactivado correctamente');
      setPendingDeactivate(null);
      await loadHorarios();
      await loadAsignaciones();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo desactivar el horario');
    }
  }

  // Matriz visual operations
  function navigateWeek(weeksOffset) {
    const current = new Date(currentWeekStart + 'T00:00:00');
    current.setDate(current.getDate() + weeksOffset * 7);
    setCurrentWeekStart(formatDateString(current));
  }

  function getAssignmentForDate(empId, dateString) {
    return asignaciones.find((assign) => {
      if (assign.empleado_id !== empId) return false;
      if (!assign.activo) return false;
      return assign.fecha_inicio <= dateString && (!assign.fecha_fin || assign.fecha_fin >= dateString);
    });
  }

  function getScheduleForDate(empId, date) {
    const dateString = formatDateString(date);
    const assign = getAssignmentForDate(empId, dateString);
    if (!assign) return null;

    const horario = horarios.find((h) => h.id === assign.horario_id);
    if (!horario) return null;

    const day = date.getDay();
    const weekday = day === 0 ? 7 : day;

    if (horario.dias_semana && horario.dias_semana.includes(weekday)) {
      return { horario, asignacion: assign };
    }
    return { horario: null, asignacion: assign, descanso: true };
  }

  async function handleCellClick(empId, date) {
    if (!selectedHorarioForQuickAssign) {
      toast.info('Seleccione un horario arriba para asignar rápidamente');
      return;
    }
    const dateString = formatDateString(date);
    setLoading(true);
    try {
      await horarioService.assignHorario({
        empleado_id: empId,
        horario_id: selectedHorarioForQuickAssign,
        fecha_inicio: dateString,
      });
      toast.success('Horario asignado correctamente');
      await loadAsignaciones();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al asignar horario');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveCellAssignment(assignId, event) {
    event.stopPropagation();
    if (!window.confirm('¿Está seguro de eliminar esta asignación de horario?')) return;
    setLoading(true);
    try {
      await horarioService.deleteAsignacion(assignId);
      toast.success('Asignación eliminada correctamente');
      await loadAsignaciones();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar la asignación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Horarios y Planificación"
        description="Planifica turnos visualmente o gestiona configuraciones horarias."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando...' : `${total} horarios`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nuevo horario
            </button>
            <button className="primary-button compact" type="button" onClick={() => openAssignForm()}>
              <CalendarPlus size={16} />
              Asignar horario
            </button>
          </>
        }
      />

      <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
        <button
          className={`tab-btn ${activeTab === 'matriz' ? 'active' : ''}`}
          onClick={() => setActiveTab('matriz')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matriz' ? '3px solid var(--primary-color)' : '3px solid transparent',
            padding: '0.5rem 1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: activeTab === 'matriz' ? 'var(--primary-color)' : 'var(--text-muted)'
          }}
        >
          <Grid size={16} />
          Planificador Semanal
        </button>
        <button
          className={`tab-btn ${activeTab === 'lista' ? 'active' : ''}`}
          onClick={() => setActiveTab('lista')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'lista' ? '3px solid var(--primary-color)' : '3px solid transparent',
            padding: '0.5rem 1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: activeTab === 'lista' ? 'var(--primary-color)' : 'var(--text-muted)'
          }}
        >
          <List size={16} />
          Horarios Registrados
        </button>
      </div>

      <ActionDialog
        open={Boolean(pendingDeactivate)}
        danger
        title="Desactivar horario"
        message={`Se desactivara "${pendingDeactivate?.nombre || ''}" y no deberia usarse en nuevas asignaciones.`}
        confirmLabel="Desactivar"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => deactivateHorario(pendingDeactivate)}
      />

      <ActionDialog
        open={Boolean(pendingDeleteAsignacion)}
        danger
        title="Eliminar asignacion"
        message={`Se desactivara la asignacion de ${pendingDeleteAsignacion?.empleado_codigo || ''}.`}
        confirmLabel="Eliminar asignacion"
        onCancel={() => setPendingDeleteAsignacion(null)}
        onConfirm={() => removeAssignment(pendingDeleteAsignacion)}
      />

      {showForm ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <PanelTitle title={selectedHorario ? 'Editar horario' : 'Nuevo horario'} subtitle="Hora entrada, salida, tolerancia y dias laborales" />
            <HorarioForm horario={selectedHorario} sucursales={sucursales} loading={formLoading} onCancel={closeForm} onSubmit={saveHorario} />
          </div>
        </div>
      ) : null}

      {showAssignForm ? (
        <div className="modal-backdrop" onClick={closeAssignForm}>
          <div className="modal-panel large-modal" onClick={(event) => event.stopPropagation()}>
            <PanelTitle title="Asignar horario" subtitle="Vincula uno o más empleados activos con un turno vigente" />
            <form className="module-form" onSubmit={saveAssignment}>
              <div className="bulk-assign-container">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr', height: 'fit-content' }}>
                  <label>
                    Horario
                    <select
                      required
                      value={assignment.horario_id}
                      onChange={(event) => setAssignment((current) => ({ ...current, horario_id: event.target.value }))}
                    >
                      <option value="">Seleccionar horario</option>
                      {horarios
                        .filter((horario) => horario.activo)
                        .map((horario) => (
                          <option key={horario.id} value={horario.id}>
                            {horario.nombre} ({timeOnly(horario.hora_inicio)} - {timeOnly(horario.hora_fin)})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Fecha inicio
                    <input
                      required
                      type="date"
                      value={assignment.fecha_inicio}
                      onChange={(event) => setAssignment((current) => ({ ...current, fecha_inicio: event.target.value }))}
                    />
                  </label>
                  <label>
                    Fecha fin (Opcional)
                    <input
                      type="date"
                      value={assignment.fecha_fin}
                      onChange={(event) => setAssignment((current) => ({ ...current, fecha_fin: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="employee-check-list-wrapper">
                  <label>Empleados a asignar ({selectedEmployeeIds.length} seleccionados)</label>
                  
                  <div className="employee-search-wrapper">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Buscar por código o nombre..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                    />
                  </div>

                  <div className="employee-check-list">
                    {empleados.length ? (
                      (() => {
                        const filtered = empleados.filter((emp) => {
                          const query = employeeSearch.toLowerCase().trim();
                          if (!query) return true;
                          const fullName = `${emp.nombres || ''} ${emp.apellidos || ''}`.toLowerCase();
                          const code = (emp.codigo || '').toLowerCase();
                          return fullName.includes(query) || code.includes(query);
                        });

                        const isAllSelected = filtered.length > 0 && filtered.every((emp) => selectedEmployeeIds.includes(emp.id));

                        return (
                          <>
                            {filtered.length > 0 && (
                              <div className="select-all-row" onClick={() => toggleSelectAll(filtered)}>
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  onChange={() => {}}
                                />
                                <span>Seleccionar todos los filtrados</span>
                              </div>
                            )}

                            {filtered.length > 0 ? (
                              filtered.map((empleado) => {
                                const isSelected = selectedEmployeeIds.includes(empleado.id);
                                return (
                                  <div
                                    key={empleado.id}
                                    className={`employee-check-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => toggleEmployeeSelection(empleado.id)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                    />
                                    <span>
                                      <strong>{empleado.codigo}</strong> - {empleado.nombres} {empleado.apellidos}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <p style={{ padding: '12px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                                Ningún empleado coincide con la búsqueda
                              </p>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <p style={{ padding: '12px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                        No hay empleados activos registrados
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button className="outline-button" type="button" onClick={closeAssignForm}>
                  Cancelar
                </button>
                <button
                  className="primary-button compact"
                  disabled={assignLoading || !selectedEmployeeIds.length || !horarios.some((horario) => horario.activo)}
                >
                  {assignLoading ? 'Asignando...' : `Asignar horario (${selectedEmployeeIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeTab === 'matriz' ? (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <PanelTitle
              title="Planificador de Turnos Semanal"
              subtitle="Haz click en una celda vacía para asignar rápidamente el horario elegido"
            />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', overflow: 'hidden' }}>
                <button className="icon-button" style={{ height: '36px', width: '36px', borderRadius: 0 }} onClick={() => navigateWeek(-1)} title="Semana anterior">
                  <ChevronLeft size={18} />
                </button>
                <span style={{ padding: '0 0.75rem', fontSize: '14px', fontWeight: 'bold' }}>
                  Semana del {currentWeekStart}
                </span>
                <button className="icon-button" style={{ height: '36px', width: '36px', borderRadius: 0 }} onClick={() => navigateWeek(1)} title="Siguiente semana">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Horario Rápido:</span>
                <select
                  aria-label="Horario rapido"
                  style={{ minWidth: '180px', margin: 0 }}
                  value={selectedHorarioForQuickAssign}
                  onChange={(e) => setSelectedHorarioForQuickAssign(e.target.value)}
                >
                  <option value="">-- Ninguno --</option>
                  {horarios.filter(h => h.activo).map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nombre} ({timeOnly(h.hora_inicio)}-{timeOnly(h.hora_fin)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ minWidth: '160px', padding: '12px' }}>Empleado</th>
                  {weekDates.map((date, idx) => {
                    const dayLabelsString = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
                    const isToday = formatDateString(date) === formatDateString(new Date());
                    return (
                      <th key={idx} style={{
                        padding: '12px',
                        textAlign: 'center',
                        backgroundColor: isToday ? 'rgba(var(--primary-color-rgb, 99, 102, 241), 0.1)' : 'transparent',
                        borderLeft: '1px solid var(--border-color)'
                      }}>
                        <div>{dayLabelsString[date.getDay()]}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{date.getDate()} {date.toLocaleString('es-EC', { month: 'short' })}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {empleados.length ? (
                  empleados.map((empleado) => (
                    <tr key={empleado.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>
                        <div>{empleado.nombres} {empleado.apellidos}</div>
                      </td>
                      {weekDates.map((date, idx) => {
                        const cellData = getScheduleForDate(empleado.id, date);
                        return (
                          <td
                            key={idx}
                            onClick={() => !cellData?.horario && handleCellClick(empleado.id, date)}
                            style={{
                              padding: '8px',
                              textAlign: 'center',
                              cursor: cellData?.horario ? 'default' : 'pointer',
                              borderLeft: '1px solid var(--border-color)',
                              backgroundColor: cellData?.descanso ? 'var(--background-alt, #f8fafc)' : 'transparent',
                              transition: 'background-color 0.2s',
                              position: 'relative'
                            }}
                            className={!cellData?.horario ? 'hover-cell' : ''}
                            title={!cellData?.horario ? 'Click para asignar horario seleccionado' : ''}
                          >
                            {cellData?.horario ? (
                              <div style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.25rem',
                                backgroundColor: 'rgba(var(--primary-color-rgb, 99, 102, 241), 0.1)',
                                color: 'var(--primary-color)',
                                border: '1px solid rgba(var(--primary-color-rgb, 99, 102, 241), 0.3)',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                width: '100%',
                                minHeight: '52px',
                                justifyContent: 'center'
                              }}>
                                <span style={{ fontWeight: 'bold', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                                  {cellData.horario.nombre}
                                </span>
                                <span style={{ fontSize: '10px' }}>
                                  {timeOnly(cellData.horario.hora_inicio)} - {timeOnly(cellData.horario.hora_fin)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleRemoveCellAssignment(cellData.asignacion.id, e)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: 'var(--accent-color, #ef4444)',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    padding: '2px 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '2px'
                                  }}
                                  className="remove-cell-btn"
                                  title="Quitar horario"
                                >
                                  Quitar
                                </button>
                              </div>
                            ) : cellData?.descanso ? (
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '12px 0' }}>
                                Descanso
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px', border: '1px dashed var(--border-color)', borderRadius: '4px', padding: '12px 0', opacity: 0.5 }}>
                                + Asignar
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay empleados activos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <PanelTitle title="Filtros" subtitle="Busca por nombre, estado o sucursal" />
            <div className="toolbar-grid">
              <label className="search-box inline-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar horario" />
              </label>
              <select value={activo} onChange={(event) => setActivo(event.target.value)}>
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
              <select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
                <option value="">Todas las sucursales</option>
                {sucursales.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre}
                  </option>
                ))}
              </select>
              <button className="outline-button" type="button" onClick={loadHorarios}>
                <RotateCcw size={16} />
                Aplicar
              </button>
            </div>
          </div>

          <div className="panel">
            <PanelTitle title="Horarios registrados" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Sucursal</th>
                    <th>Dias</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Tolerancia</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {horarios.length ? (
                    horarios.map((horario) => (
                      <tr key={horario.id}>
                        <td>{horario.nombre}</td>
                        <td>{horario.sucursal_nombre || '-'}</td>
                        <td>{daysText(horario.dias_semana)}</td>
                        <td>{timeOnly(horario.hora_inicio)}</td>
                        <td>{timeOnly(horario.hora_fin)}</td>
                        <td>{horario.tolerancia_minutos} min</td>
                        <td>
                          <span className={horario.activo ? 'status-pill' : 'status-pill muted'}>{horario.activo ? 'activo' : 'inactivo'}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-button" type="button" onClick={() => openEditForm(horario)} title="Editar horario" aria-label="Editar horario">
                              <Edit size={16} />
                            </button>
                            <button className="icon-button" type="button" onClick={() => openAssignForm(horario)} title="Asignar horario" aria-label="Asignar horario">
                              <CalendarPlus size={16} />
                            </button>
                            <button className="icon-button danger" type="button" onClick={() => setPendingDeactivate(horario)} title="Desactivar horario" aria-label="Desactivar horario">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8">Sin horarios para mostrar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <PanelTitle title="Asignaciones recientes" subtitle="Empleados con horario activo" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Horario</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.length ? (
                    asignaciones.slice(0, 15).map((asignacion) => (
                      <tr key={asignacion.id}>
                        <td>{`${asignacion.empleado_codigo} - ${asignacion.empleado_nombres} ${asignacion.empleado_apellidos}`}</td>
                        <td>{asignacion.horario_nombre}</td>
                        <td>{String(asignacion.fecha_inicio || '-').slice(0, 10)}</td>
                        <td>{asignacion.fecha_fin ? String(asignacion.fecha_fin).slice(0, 10) : '-'}</td>
                        <td>
                          <span className={asignacion.activo ? 'status-pill' : 'status-pill muted'}>{asignacion.activo ? 'activo' : 'inactivo'}</span>
                        </td>
                        <td>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => setPendingDeleteAsignacion(asignacion)}
                            title="Eliminar asignacion"
                            aria-label="Eliminar asignacion"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6">Sin asignaciones para mostrar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
