import { useEffect, useState } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as planService from '../../services/planService';
import { toast } from '../../services/toastService';
import PlanForm from './PlanForm';

export default function PlanesList() {
  const [planes, setPlanes] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  async function loadPlanes() {
    setLoading(true);
    setError('');

    try {
      setPlanes(await planService.listPlanes({ incluirInactivos: true }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los planes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlanes();
  }, []);

  function openCreateForm() {
    setSelectedPlan(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(plan) {
    setSelectedPlan(plan);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedPlan(null);
    setShowForm(false);
  }

  async function savePlan(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedPlan) {
        await planService.updatePlan(selectedPlan.id, values);
        setMessage('Plan actualizado correctamente');
        toast.success('Plan actualizado correctamente');
      } else {
        await planService.createPlan(values);
        setMessage('Plan creado correctamente');
        toast.success('Plan creado correctamente');
      }

      closeForm();
      await loadPlanes();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar el plan');
    } finally {
      setFormLoading(false);
    }
  }

  async function deactivatePlan(plan) {
    setMessage('');
    setError('');

    try {
      await planService.deletePlan(plan.id);
      setMessage('Plan desactivado correctamente');
      toast.success('Plan desactivado correctamente');
      setPendingDeactivate(null);
      await loadPlanes();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo desactivar el plan');
    }
  }

  return (
    <>
      <PageHeader
        title="Planes"
        description="Administracion de planes SaaS: Gratis, Basico, Pyme, Empresarial y Corporativo."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${planes.length} planes`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nuevo plan
            </button>
          </>
        }
      />

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <ActionDialog
        open={Boolean(pendingDeactivate)}
        danger
        title="Desactivar plan"
        message={`Se desactivara "${pendingDeactivate?.nombre || ''}" para nuevas contrataciones.`}
        confirmLabel="Desactivar"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => deactivatePlan(pendingDeactivate)}
      />

      {showForm ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <PanelTitle title={selectedPlan ? 'Editar plan' : 'Nuevo plan'} subtitle="Precio, limites y disponibilidad" />
            <PlanForm plan={selectedPlan} loading={formLoading} onCancel={closeForm} onSubmit={savePlan} />
          </div>
        </div>
      ) : null}

      <div className="panel">
        <PanelTitle title="Planes comerciales" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Empleados</th>
                <th>Sucursales</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {planes.length ? (
                planes.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.codigo}</td>
                    <td>{plan.nombre}</td>
                    <td>${Number(plan.precio_mensual || 0).toFixed(2)}</td>
                    <td>{plan.limite_empleados ?? 'Sin limite'}</td>
                    <td>{plan.limite_sucursales ?? 'Sin limite'}</td>
                    <td>
                      <span className={plan.activo ? 'status-pill' : 'status-pill muted'}>{plan.activo ? 'activo' : 'inactivo'}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => openEditForm(plan)} title="Editar plan" aria-label="Editar plan">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingDeactivate(plan)} title="Desactivar plan" aria-label="Desactivar plan">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">Sin planes para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
