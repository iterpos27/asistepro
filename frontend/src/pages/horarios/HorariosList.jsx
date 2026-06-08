import { useEffect, useState } from 'react';
import { Edit, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as horarioService from '../../services/horarioService';
import * as sucursalService from '../../services/sucursalService';
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

export default function HorariosList() {
  const [horarios, setHorarios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [activo, setActivo] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [selectedHorario, setSelectedHorario] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  async function loadSucursales() {
    const result = await sucursalService.listSucursales({ limit: 100 });
    setSucursales(result.items || []);
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
      const result = await horarioService.listAsignaciones({ activo: 'true', limit: 8 });
      setAsignaciones(result.items || []);
    } catch {
      setAsignaciones([]);
    }
  }

  useEffect(() => {
    loadSucursales().catch((requestError) => {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las sucursales');
    });
    loadHorarios();
    loadAsignaciones();
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

  async function saveHorario(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedHorario) {
        await horarioService.updateHorario(selectedHorario.id, values);
        setMessage('Horario actualizado correctamente');
      } else {
        await horarioService.createHorario(values);
        setMessage('Horario creado correctamente');
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
      setPendingDeactivate(null);
      await loadHorarios();
      await loadAsignaciones();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo desactivar el horario');
    }
  }

  return (
    <>
      <PageHeader
        title="Horarios"
        description="Turnos, tolerancias y dias laborales por empresa."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nuevo horario
            </button>
          </>
        }
      />

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

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <ActionDialog
        open={Boolean(pendingDeactivate)}
        danger
        title="Desactivar horario"
        message={`Se desactivara "${pendingDeactivate?.nombre || ''}" y no deberia usarse en nuevas asignaciones.`}
        confirmLabel="Desactivar"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => deactivateHorario(pendingDeactivate)}
      />

      {showForm ? (
        <div className="panel">
          <PanelTitle title={selectedHorario ? 'Editar horario' : 'Nuevo horario'} subtitle="Hora entrada, salida, tolerancia y dias laborales" />
          <HorarioForm horario={selectedHorario} sucursales={sucursales} loading={formLoading} onCancel={closeForm} onSubmit={saveHorario} />
        </div>
      ) : null}

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
                        <button className="icon-button" type="button" onClick={() => openEditForm(horario)} aria-label="Editar horario">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingDeactivate(horario)} aria-label="Desactivar horario">
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
              </tr>
            </thead>
            <tbody>
              {asignaciones.length ? (
                asignaciones.map((asignacion) => (
                  <tr key={asignacion.id}>
                    <td>{`${asignacion.empleado_codigo} - ${asignacion.empleado_nombres} ${asignacion.empleado_apellidos}`}</td>
                    <td>{asignacion.horario_nombre}</td>
                    <td>{String(asignacion.fecha_inicio || '-').slice(0, 10)}</td>
                    <td>{asignacion.fecha_fin ? String(asignacion.fecha_fin).slice(0, 10) : '-'}</td>
                    <td>
                      <span className={asignacion.activo ? 'status-pill' : 'status-pill muted'}>{asignacion.activo ? 'activo' : 'inactivo'}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">Sin asignaciones para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
