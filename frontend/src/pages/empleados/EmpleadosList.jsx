import { useEffect, useState } from 'react';
import { Edit, Eye, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as empleadoService from '../../services/empleadoService';
import * as sucursalService from '../../services/sucursalService';
import EmpleadoDetalle from './EmpleadoDetalle';
import EmpleadoForm from './EmpleadoForm';

function statusClass(estado) {
  if (estado === 'activo') return 'status-pill';
  if (estado === 'suspendido') return 'status-pill warning';
  return 'status-pill muted';
}

export default function EmpleadosList() {
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [detailEmpleado, setDetailEmpleado] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadSucursales() {
    const result = await sucursalService.listSucursales({ limit: 100 });
    setSucursales(result.items || []);
  }

  async function loadEmpleados() {
    setLoading(true);
    setError('');

    try {
      const result = await empleadoService.listEmpleados({
        search,
        estado,
        sucursalId,
        limit: 100,
      });
      setEmpleados(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los empleados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSucursales().catch((requestError) => {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las sucursales');
    });
    loadEmpleados();
  }, []);

  function openCreateForm() {
    setSelectedEmpleado(null);
    setDetailEmpleado(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(empleado) {
    setSelectedEmpleado(empleado);
    setDetailEmpleado(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedEmpleado(null);
    setShowForm(false);
  }

  async function saveEmpleado(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedEmpleado) {
        await empleadoService.updateEmpleado(selectedEmpleado.id, values);
        setMessage('Empleado actualizado correctamente');
      } else {
        await empleadoService.createEmpleado(values);
        setMessage('Empleado creado correctamente');
      }

      closeForm();
      await loadEmpleados();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar el empleado');
    } finally {
      setFormLoading(false);
    }
  }

  async function deactivateEmpleado(empleado) {
    const confirmed = window.confirm(`Desactivar al empleado "${empleado.nombres} ${empleado.apellidos}"?`);
    if (!confirmed) return;

    setMessage('');
    setError('');

    try {
      await empleadoService.deleteEmpleado(empleado.id);
      setMessage('Empleado desactivado correctamente');
      await loadEmpleados();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo desactivar el empleado');
    }
  }

  return (
    <>
      <PageHeader
        title="Empleados"
        description="Directorio laboral por empresa, sucursal habitual y estado."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nuevo empleado
            </button>
          </>
        }
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Busca por codigo, nombre, apellido o correo" />
        <div className="toolbar-grid">
          <label className="search-box inline-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empleado" />
          </label>
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
          <button className="outline-button" type="button" onClick={loadEmpleados}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      {showForm ? (
        <div className="panel">
          <PanelTitle title={selectedEmpleado ? 'Editar empleado' : 'Nuevo empleado'} subtitle="Datos personales, cargo y sucursal habitual" />
          <EmpleadoForm empleado={selectedEmpleado} sucursales={sucursales} loading={formLoading} onCancel={closeForm} onSubmit={saveEmpleado} />
        </div>
      ) : null}

      <EmpleadoDetalle empleado={detailEmpleado} onClose={() => setDetailEmpleado(null)} />

      <div className="panel">
        <PanelTitle title="Empleados registrados" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Telefono</th>
                <th>Cargo</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.length ? (
                empleados.map((empleado) => (
                  <tr key={empleado.id}>
                    <td>{empleado.codigo}</td>
                    <td>{`${empleado.nombres} ${empleado.apellidos}`}</td>
                    <td>{empleado.email || empleado.usuario_email || '-'}</td>
                    <td>{empleado.telefono || '-'}</td>
                    <td>{empleado.cargo || '-'}</td>
                    <td>{empleado.sucursal_habitual_nombre || '-'}</td>
                    <td>
                      <span className={statusClass(empleado.estado)}>{empleado.estado}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => setDetailEmpleado(empleado)} aria-label="Ver empleado">
                          <Eye size={16} />
                        </button>
                        <button className="icon-button" type="button" onClick={() => openEditForm(empleado)} aria-label="Editar empleado">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => deactivateEmpleado(empleado)} aria-label="Desactivar empleado">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">Sin empleados para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
