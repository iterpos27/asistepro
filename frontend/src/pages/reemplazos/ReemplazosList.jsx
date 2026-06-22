import { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as empleadoService from '../../services/empleadoService';
import * as reemplazoService from '../../services/reemplazoService';
import * as sucursalService from '../../services/sucursalService';
import { toast } from '../../services/toastService';

const emptyForm = {
  empleado_id: '',
  sucursal_id: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin: new Date().toISOString().slice(0, 10),
  hora_inicio: '',
  hora_fin: '',
  motivo: '',
  observacion: '',
};

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function timeOnly(value) {
  return value ? String(value).slice(0, 5) : '-';
}

function statusClass(estado) {
  if (estado === 'activo') return 'status-pill';
  if (estado === 'cancelado') return 'status-pill danger';
  return 'status-pill muted';
}

export default function ReemplazosList() {
  const [reemplazos, setReemplazos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [filters, setFilters] = useState({ search: '', empleadoId: '', sucursalId: '', estado: 'activo' });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null);

  const activeEmpleados = useMemo(() => empleados.filter((empleado) => empleado.estado === 'activo'), [empleados]);

  async function loadCatalogs() {
    const [empleadosResult, sucursalesResult] = await Promise.all([
      empleadoService.listEmpleados({ estado: 'activo', limit: 100 }),
      sucursalService.listSucursales({ estado: 'activa', limit: 100 }),
    ]);
    setEmpleados(empleadosResult.items || []);
    setSucursales(sucursalesResult.items || []);
  }

  async function loadReemplazos() {
    setLoading(true);
    setError('');

    try {
      const result = await reemplazoService.listReemplazos({ ...filters, limit: 100 });
      setReemplazos(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los reemplazos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogs().catch((requestError) => {
      setError(requestError.response?.data?.message || 'No se pudieron cargar empleados o sucursales');
    });
    loadReemplazos();
  }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setSelected(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(reemplazo) {
    setSelected(reemplazo);
    setForm({
      empleado_id: reemplazo.empleado_id,
      sucursal_id: reemplazo.sucursal_id,
      fecha_inicio: dateOnly(reemplazo.fecha_inicio),
      fecha_fin: dateOnly(reemplazo.fecha_fin),
      hora_inicio: reemplazo.hora_inicio ? timeOnly(reemplazo.hora_inicio) : '',
      hora_fin: reemplazo.hora_fin ? timeOnly(reemplazo.hora_fin) : '',
      motivo: reemplazo.motivo || '',
      observacion: reemplazo.observacion || '',
    });
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setSelected(null);
    setForm(emptyForm);
  }

  async function saveReemplazo(event) {
    event.preventDefault();
    setFormLoading(true);
    setError('');

    const payload = {
      empleado_id: form.empleado_id,
      sucursal_id: form.sucursal_id,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      motivo: form.motivo,
      observacion: form.observacion || null,
    };

    try {
      if (selected) {
        await reemplazoService.updateReemplazo(selected.id, payload);
        setMessage('Reemplazo actualizado correctamente');
        toast.success('Reemplazo actualizado correctamente');
      } else {
        await reemplazoService.createReemplazo(payload);
        setMessage('Reemplazo autorizado correctamente');
        toast.success('Reemplazo autorizado correctamente');
      }

      closeForm();
      await loadReemplazos();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar el reemplazo');
    } finally {
      setFormLoading(false);
    }
  }

  async function cancelReemplazo(reemplazo) {
    setError('');
    setMessage('');

    try {
      await reemplazoService.cancelReemplazo(reemplazo.id);
      setPendingCancel(null);
      setMessage('Reemplazo cancelado correctamente');
      toast.success('Reemplazo cancelado correctamente');
      await loadReemplazos();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cancelar el reemplazo');
    }
  }

  return (
    <>
      <PageHeader
        title="Reemplazos"
        description="Autorizaciones para marcar temporalmente en otra sucursal."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>
            <button className="primary-button compact" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Autorizar reemplazo
            </button>
          </>
        }
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Empleado, sucursal y estado de la autorizacion" />
        <div className="toolbar-grid">
          <label className="search-box inline-search">
            <Search size={16} />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Buscar reemplazo" />
          </label>
          <select value={filters.empleadoId} onChange={(event) => updateFilter('empleadoId', event.target.value)}>
            <option value="">Todos los empleados</option>
            {activeEmpleados.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.codigo} - {empleado.nombres} {empleado.apellidos}
              </option>
            ))}
          </select>
          <select value={filters.sucursalId} onChange={(event) => updateFilter('sucursalId', event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
          <select value={filters.estado} onChange={(event) => updateFilter('estado', event.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="cancelado">Cancelados</option>
            <option value="finalizado">Finalizados</option>
          </select>
          <button className="outline-button" type="button" onClick={loadReemplazos}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      <ActionDialog
        open={Boolean(pendingCancel)}
        danger
        title="Cancelar reemplazo"
        message={`Se cancelara la autorizacion de ${pendingCancel?.empleado_codigo || ''}.`}
        confirmLabel="Cancelar reemplazo"
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => cancelReemplazo(pendingCancel)}
      />

      {showForm ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <PanelTitle title={selected ? 'Editar reemplazo' : 'Autorizar reemplazo'} subtitle="Define empleado, sucursal destino y vigencia" />
            <form className="module-form" onSubmit={saveReemplazo}>
              <div className="form-grid">
                <label>
                  Empleado
                  <select required value={form.empleado_id} onChange={(event) => updateForm('empleado_id', event.target.value)}>
                    <option value="">Seleccionar empleado</option>
                    {activeEmpleados.map((empleado) => (
                      <option key={empleado.id} value={empleado.id}>
                        {empleado.codigo} - {empleado.nombres} {empleado.apellidos}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sucursal destino
                  <select required value={form.sucursal_id} onChange={(event) => updateForm('sucursal_id', event.target.value)}>
                    <option value="">Seleccionar sucursal</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha inicio
                  <input required type="date" value={form.fecha_inicio} onChange={(event) => updateForm('fecha_inicio', event.target.value)} />
                </label>
                <label>
                  Fecha fin
                  <input required type="date" value={form.fecha_fin} onChange={(event) => updateForm('fecha_fin', event.target.value)} />
                </label>
                <label>
                  Hora inicio
                  <input type="time" value={form.hora_inicio} onChange={(event) => updateForm('hora_inicio', event.target.value)} />
                </label>
                <label>
                  Hora fin
                  <input type="time" value={form.hora_fin} onChange={(event) => updateForm('hora_fin', event.target.value)} />
                </label>
                <label className="wide-field">
                  Motivo
                  <input required value={form.motivo} onChange={(event) => updateForm('motivo', event.target.value)} placeholder="Reemplazo por ausencia, apoyo temporal..." />
                </label>
                <label className="wide-field">
                  Observacion
                  <textarea value={form.observacion} onChange={(event) => updateForm('observacion', event.target.value)} placeholder="Detalle interno opcional" />
                </label>
              </div>
              <div className="form-actions">
                <button className="outline-button" type="button" onClick={closeForm}>
                  Cancelar
                </button>
                <button className="primary-button compact" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : selected ? 'Actualizar' : 'Autorizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <PanelTitle title="Autorizaciones registradas" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Sucursal destino</th>
                <th>Vigencia</th>
                <th>Horario</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reemplazos.length ? (
                reemplazos.map((reemplazo) => (
                  <tr key={reemplazo.id}>
                    <td>{`${reemplazo.empleado_codigo} - ${reemplazo.empleado_nombres} ${reemplazo.empleado_apellidos}`}</td>
                    <td>{reemplazo.sucursal_nombre}</td>
                    <td>{`${dateOnly(reemplazo.fecha_inicio)} a ${dateOnly(reemplazo.fecha_fin)}`}</td>
                    <td>{`${timeOnly(reemplazo.hora_inicio)} - ${timeOnly(reemplazo.hora_fin)}`}</td>
                    <td>{reemplazo.motivo}</td>
                    <td>
                      <span className={statusClass(reemplazo.estado)}>{reemplazo.estado}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => openEditForm(reemplazo)} title="Editar reemplazo" aria-label="Editar reemplazo">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingCancel(reemplazo)} title="Cancelar reemplazo" aria-label="Cancelar reemplazo">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">Sin reemplazos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
