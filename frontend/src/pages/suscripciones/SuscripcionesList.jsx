import { useEffect, useState } from 'react';
import { Edit, Plus, RotateCcw, Trash2 } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as empresaService from '../../services/empresaService';
import { toast } from '../../services/toastService';
import * as planService from '../../services/planService';
import * as suscripcionService from '../../services/suscripcionService';
import SuscripcionForm from './SuscripcionForm';

function statusClass(estado) {
  if (estado === 'activa') return 'status-pill';
  if (estado === 'suspendida' || estado === 'vencida') return 'status-pill warning';
  return 'status-pill muted';
}

function dateOnly(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export default function SuscripcionesList() {
  const [suscripciones, setSuscripciones] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [estado, setEstado] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [total, setTotal] = useState(0);
  const [selectedSuscripcion, setSelectedSuscripcion] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null);

  async function loadCatalogs() {
    const [empresasResult, planesResult] = await Promise.all([
      empresaService.listEmpresas({ limit: 100 }),
      planService.listPlanes({ incluirInactivos: true }),
    ]);
    setEmpresas(empresasResult.items || []);
    setPlanes(planesResult || []);
  }

  async function loadSuscripciones() {
    setLoading(true);
    setError('');

    try {
      const result = await suscripcionService.listSuscripciones({ empresaId, estado, limit: 100 });
      setSuscripciones(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las suscripciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogs().catch((requestError) => {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los catalogos');
    });
    loadSuscripciones();
  }, []);

  function openCreateForm() {
    setSelectedSuscripcion(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(suscripcion) {
    setSelectedSuscripcion(suscripcion);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedSuscripcion(null);
    setShowForm(false);
  }

  async function saveSuscripcion(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedSuscripcion) {
        await suscripcionService.updateSuscripcion(selectedSuscripcion.id, values);
        setMessage('Suscripcion actualizada correctamente');
        toast.success('Suscripcion actualizada correctamente');
      } else {
        await suscripcionService.createSuscripcion(values);
        setMessage('Suscripcion creada correctamente');
        toast.success('Suscripcion creada correctamente');
      }

      closeForm();
      await loadSuscripciones();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar la suscripcion');
    } finally {
      setFormLoading(false);
    }
  }

  async function cancelSuscripcion(suscripcion) {
    setMessage('');
    setError('');

    try {
      await suscripcionService.deleteSuscripcion(suscripcion.id);
      setMessage('Suscripcion cancelada correctamente');
      toast.success('Suscripcion cancelada correctamente');
      setPendingCancel(null);
      await loadSuscripciones();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cancelar la suscripcion');
    }
  }

  return (
    <>
      <PageHeader
        title="Suscripciones"
        description="Asignacion de planes SaaS por empresa."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nueva suscripcion
            </button>
          </>
        }
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Filtra por empresa o estado" />
        <div className="toolbar-grid">
          <select value={empresaId} onChange={(event) => setEmpresaId(event.target.value)}>
            <option value="">Todas las empresas</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nombre}
              </option>
            ))}
          </select>
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
            <option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <button className="outline-button" type="button" onClick={loadSuscripciones}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      <ActionDialog
        open={Boolean(pendingCancel)}
        danger
        title="Cancelar suscripcion"
        message={`Se cancelara la suscripcion de "${pendingCancel?.empresa_nombre || ''}".`}
        confirmLabel="Cancelar suscripcion"
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => cancelSuscripcion(pendingCancel)}
      />

      {showForm ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <PanelTitle title={selectedSuscripcion ? 'Editar suscripcion' : 'Nueva suscripcion'} subtitle="Empresa, plan, estado y vigencia" />
            <SuscripcionForm
              suscripcion={selectedSuscripcion}
              empresas={empresas}
              planes={planes}
              loading={formLoading}
              onCancel={closeForm}
              onSubmit={saveSuscripcion}
            />
          </div>
        </div>
      ) : null}

      <div className="panel">
        <PanelTitle title="Suscripciones registradas" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Monto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suscripciones.length ? (
                suscripciones.map((suscripcion) => (
                  <tr key={suscripcion.id}>
                    <td>{suscripcion.empresa_nombre}</td>
                    <td>{suscripcion.plan_nombre}</td>
                    <td>
                      <span className={statusClass(suscripcion.estado)}>{suscripcion.estado}</span>
                    </td>
                    <td>{dateOnly(suscripcion.fecha_inicio)}</td>
                    <td>{dateOnly(suscripcion.fecha_fin)}</td>
                    <td>${Number(suscripcion.monto_mensual || 0).toFixed(2)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => openEditForm(suscripcion)} title="Editar suscripcion" aria-label="Editar suscripcion">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingCancel(suscripcion)} title="Cancelar suscripcion" aria-label="Cancelar suscripcion">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">Sin suscripciones para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
