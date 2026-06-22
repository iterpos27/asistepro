import { useEffect, useMemo, useState } from 'react';
import { Edit, Eye, Plus, RotateCcw, Search, Trash2, UserCheck, Users, Wallet } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import MetricCard from '../../components/cards/MetricCard';
import * as empleadoService from '../../services/empleadoService';
import * as organizacionService from '../../services/organizacionService';
import { toast } from '../../services/toastService';
import * as sucursalService from '../../services/sucursalService';
import EmpleadoDetalle from './EmpleadoDetalle';
import EmpleadoForm from './EmpleadoForm';

const contractTypes = ['Indefinido', 'Temporal', 'Por horas', 'Servicios profesionales', 'Pasantia'];

function statusClass(estado) {
  if (estado === 'activo') return 'status-pill';
  if (estado === 'suspendido') return 'status-pill warning';
  return 'status-pill muted';
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function EmpleadosList() {
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [catalogs, setCatalogs] = useState({ estructuras: [], supervisores: [] });
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    estado: '',
    sucursalId: '',
    areaId: '',
    supervisorId: '',
    tipoContrato: '',
  });
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [detailEmpleado, setDetailEmpleado] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  const areaOptions = useMemo(
    () => (catalogs.estructuras || []).filter((item) => ['direccion', 'departamento', 'area', 'unidad'].includes(item.tipo)),
    [catalogs.estructuras],
  );

  const summary = useMemo(() => {
    const activos = empleados.filter((item) => item.estado === 'activo').length;
    const conUsuario = empleados.filter((item) => item.usuario_email).length;
    const salarioBase = empleados.reduce((totalSalary, item) => totalSalary + Number(item.salario_base || 0), 0);
    const sinSupervisor = empleados.filter((item) => item.estado === 'activo' && !item.supervisor_empleado_id).length;
    return { activos, conUsuario, salarioBase, sinSupervisor };
  }, [empleados]);

  async function loadCatalogs() {
    const [sucursalesResult, organizationCatalogs] = await Promise.all([
      sucursalService.listSucursales({ limit: 100 }),
      organizacionService.getCatalogs(),
    ]);
    setSucursales(sucursalesResult.items || []);
    setCatalogs(organizationCatalogs || { estructuras: [], supervisores: [] });
  }

  async function loadEmpleados() {
    setLoading(true);
    setError('');

    try {
      const result = await empleadoService.listEmpleados({
        search: filters.search,
        estado: filters.estado,
        sucursalId: filters.sucursalId,
        areaId: filters.areaId,
        supervisorId: filters.supervisorId,
        tipoContrato: filters.tipoContrato,
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
    loadCatalogs().catch((requestError) => {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los catalogos de RRHH');
    });
    loadEmpleados();
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

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

  async function openDetail(empleado) {
    setError('');
    try {
      const detail = await empleadoService.getEmpleado(empleado.id);
      setDetailEmpleado(detail);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cargar la ficha del empleado');
    }
  }

  async function saveEmpleado(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedEmpleado) {
        await empleadoService.updateEmpleado(selectedEmpleado.id, values);
        setMessage('Empleado actualizado correctamente');
        toast.success('Empleado actualizado correctamente');
      } else {
        await empleadoService.createEmpleado(values);
        setMessage('Empleado creado correctamente');
        toast.success('Empleado creado correctamente');
      }

      closeForm();
      await loadCatalogs();
      await loadEmpleados();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar el empleado');
    } finally {
      setFormLoading(false);
    }
  }

  async function deactivateEmpleado(empleado) {
    setMessage('');
    setError('');

    try {
      await empleadoService.deleteEmpleado(empleado.id);
      setMessage('Empleado desactivado correctamente');
      toast.success('Empleado desactivado correctamente');
      setPendingDeactivate(null);
      await loadCatalogs();
      await loadEmpleados();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo desactivar el empleado');
    }
  }

  return (
    <>
      <PageHeader
        title="Empleados"
        description="RRHH operativo: ficha laboral, estructura organizacional, supervisor y acceso al sistema."
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

      <section className="metrics-grid">
        <MetricCard label="Activos" value={summary.activos} icon={UserCheck} tone="success" />
        <MetricCard label="Con acceso" value={summary.conUsuario} icon={Users} tone="accent" />
        <MetricCard label="Nomina base" value={money(summary.salarioBase)} icon={Wallet} tone="warning" />
        <MetricCard label="Sin supervisor" value={summary.sinSupervisor} icon={Users} />
      </section>

      <div className="panel">
        <PanelTitle title="Filtros RRHH" subtitle="Busca por persona, estructura, contrato, sucursal o supervisor" />
        <div className="toolbar-grid">
          <label className="search-box inline-search">
            <Search size={16} />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Buscar empleado" />
          </label>
          <select value={filters.estado} onChange={(event) => updateFilter('estado', event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <select value={filters.sucursalId} onChange={(event) => updateFilter('sucursalId', event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
          <select value={filters.areaId} onChange={(event) => updateFilter('areaId', event.target.value)}>
            <option value="">Todas las areas</option>
            {areaOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
          <select value={filters.supervisorId} onChange={(event) => updateFilter('supervisorId', event.target.value)}>
            <option value="">Todos los supervisores</option>
            {(catalogs.supervisores || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo} - {item.nombres} {item.apellidos}
              </option>
            ))}
          </select>
          <select value={filters.tipoContrato} onChange={(event) => updateFilter('tipoContrato', event.target.value)}>
            <option value="">Todos los contratos</option>
            {contractTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="outline-button" type="button" onClick={loadEmpleados}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      <ActionDialog
        open={Boolean(pendingDeactivate)}
        danger
        title="Desactivar empleado"
        message={`Se desactivara "${pendingDeactivate?.nombres || ''} ${pendingDeactivate?.apellidos || ''}".`}
        confirmLabel="Desactivar"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => deactivateEmpleado(pendingDeactivate)}
      />

      {showForm ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <PanelTitle
              title={selectedEmpleado ? 'Editar empleado' : 'Nuevo empleado'}
              subtitle="Datos personales, estructura, contrato, supervisor y acceso al sistema"
            />
            <EmpleadoForm
              empleado={selectedEmpleado}
              sucursales={sucursales}
              catalogs={catalogs}
              supervisors={catalogs.supervisores || []}
              loading={formLoading}
              onCancel={closeForm}
              onSubmit={saveEmpleado}
            />
          </div>
        </div>
      ) : null}

      <EmpleadoDetalle empleado={detailEmpleado} onClose={() => setDetailEmpleado(null)} />

      <div className="panel">
        <PanelTitle title="Empleados registrados" subtitle="Vista util para RRHH, supervision y estructura interna" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Nombre</th>
                <th>Contrato</th>
                <th>Area</th>
                <th>Supervisor</th>
                <th>Sucursal</th>
                <th>Acceso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.length ? (
                empleados.map((empleado) => (
                  <tr key={empleado.id}>
                    <td>{empleado.codigo}</td>
                    <td>
                      <strong>{`${empleado.nombres} ${empleado.apellidos}`}</strong>
                      <span className="table-subtext">{empleado.email || empleado.usuario_email || '-'}</span>
                    </td>
                    <td>
                      {empleado.tipo_contrato || '-'}
                      <span className="table-subtext">{empleado.salario_base ? money(empleado.salario_base) : 'Sin salario base'}</span>
                    </td>
                    <td>{empleado.area_nombre || empleado.departamento || '-'}</td>
                    <td>
                      {empleado.supervisor_nombres ? `${empleado.supervisor_nombres} ${empleado.supervisor_apellidos || ''}`.trim() : '-'}
                    </td>
                    <td>{empleado.sucursal_habitual_nombre || '-'}</td>
                    <td>
                      <span className={empleado.usuario_email ? 'status-pill' : 'status-pill muted'}>
                        {empleado.usuario_email ? 'Con acceso' : 'Sin acceso'}
                      </span>
                    </td>
                    <td>
                      <span className={statusClass(empleado.estado)}>{empleado.estado}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => openDetail(empleado)} title="Ver empleado" aria-label="Ver empleado">
                          <Eye size={16} />
                        </button>
                        <button className="icon-button" type="button" onClick={() => openEditForm(empleado)} title="Editar empleado" aria-label="Editar empleado">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingDeactivate(empleado)} title="Desactivar empleado" aria-label="Desactivar empleado">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9">Sin empleados para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
