import { useEffect, useState } from 'react';
import { Edit, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as empresaService from '../../services/empresaService';
import EmpresaForm from './EmpresaForm';

function statusClass(estado) {
  if (estado === 'activa') return 'status-pill';
  if (estado === 'suspendida') return 'status-pill warning';
  return 'status-pill muted';
}

export default function EmpresasList() {
  const [empresas, setEmpresas] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null);

  async function loadEmpresas() {
    setLoading(true);
    setError('');

    try {
      const result = await empresaService.listEmpresas({ search, estado, limit: 100 });
      setEmpresas(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmpresas();
  }, []);

  function openCreateForm() {
    setSelectedEmpresa(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(empresa) {
    setSelectedEmpresa(empresa);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedEmpresa(null);
    setShowForm(false);
  }

  async function saveEmpresa(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedEmpresa) {
        await empresaService.updateEmpresa(selectedEmpresa.id, values);
        setMessage('Empresa actualizada correctamente');
      } else {
        await empresaService.createEmpresa(values);
        setMessage('Empresa creada correctamente');
      }

      closeForm();
      await loadEmpresas();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar la empresa');
    } finally {
      setFormLoading(false);
    }
  }

  async function cancelEmpresa(empresa) {
    setError('');
    setMessage('');

    try {
      await empresaService.deleteEmpresa(empresa.id);
      setMessage('Empresa cancelada correctamente');
      setPendingCancel(null);
      await loadEmpresas();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cancelar la empresa');
    }
  }

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Gestion de tenants SaaS. Solo disponible para SUPER_ADMIN."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nueva empresa
            </button>
          </>
        }
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Busca por nombre, email o identificacion fiscal" />
        <div className="toolbar-grid">
          <label className="search-box inline-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa" />
          </label>
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <button className="outline-button" type="button" onClick={loadEmpresas}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <ActionDialog
        open={Boolean(pendingCancel)}
        danger
        title="Cancelar empresa"
        message={`Se cancelara "${pendingCancel?.nombre || ''}" y quedara fuera de operacion.`}
        confirmLabel="Cancelar empresa"
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => cancelEmpresa(pendingCancel)}
      />

      {showForm ? (
        <div className="panel">
          <PanelTitle title={selectedEmpresa ? 'Editar empresa' : 'Nueva empresa'} subtitle="Datos fiscales y estado operativo" />
          <EmpresaForm empresa={selectedEmpresa} loading={formLoading} onCancel={closeForm} onSubmit={saveEmpresa} />
        </div>
      ) : null}

      <div className="panel">
        <PanelTitle title="Empresas registradas" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Plan</th>
                <th>Email</th>
                <th>Identificacion</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.length ? (
                empresas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td>{empresa.nombre}</td>
                    <td>{empresa.plan_nombre || '-'}</td>
                    <td>{empresa.email || '-'}</td>
                    <td>{empresa.identificacion_fiscal || '-'}</td>
                    <td>
                      <span className={statusClass(empresa.estado)}>{empresa.estado}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => openEditForm(empresa)} aria-label="Editar empresa">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingCancel(empresa)} aria-label="Cancelar empresa">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">Sin empresas para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
