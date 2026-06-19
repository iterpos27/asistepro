import { useEffect, useMemo, useState } from 'react';
import { Ban, CreditCard, Edit, FileText, Plus, Receipt, RotateCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import MetricCard from '../../components/cards/MetricCard';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import * as empresaService from '../../services/empresaService';
import { toast } from '../../services/toastService';
import * as facturacionService from '../../services/facturacionService';
import * as suscripcionService from '../../services/suscripcionService';
import { ROLES } from '../../utils/roles';
import FacturaForm from './FacturaForm';
import Pagos from './Pagos';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function statusClass(estado) {
  if (estado === 'pagada' || estado === 'activa') return 'status-pill';
  if (estado === 'pendiente' || estado === 'vencida' || estado === 'suspendida') return 'status-pill warning';
  return 'status-pill muted';
}

export default function Facturas({ defaultTab = 'facturas' }) {
  const { user } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const userRole = user?.rol;
  const isSuperAdmin = userRole === ROLES.SUPER_ADMIN;
  const [facturas, setFacturas] = useState([]);
  const [suscripciones, setSuscripciones] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [estado, setEstado] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [selectedFacturaId, setSelectedFacturaId] = useState('');
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'pagos' ? 'pagos' : defaultTab);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const activeSubscription = useMemo(
    () => suscripciones.find((suscripcion) => suscripcion.estado === 'activa') || suscripciones[0],
    [suscripciones],
  );

  const totals = useMemo(
    () =>
      facturas.reduce(
        (summary, factura) => ({
          facturado: summary.facturado + Number(factura.total || 0),
          pagado: summary.pagado + Number(factura.total_pagado || 0),
          pendiente:
            summary.pendiente +
            (factura.estado === 'anulada' ? 0 : Math.max(Number(factura.total || 0) - Number(factura.total_pagado || 0), 0)),
        }),
        { facturado: 0, pagado: 0, pendiente: 0 },
      ),
    [facturas],
  );

  async function loadCatalogs() {
    try {
      const [empresasResult, suscripcionesResult] = await Promise.all([
        isSuperAdmin ? empresaService.listEmpresas({ limit: 100 }) : Promise.resolve({ items: [] }),
        suscripcionService.listSuscripciones({ limit: 100 }),
      ]);
      setEmpresas(empresasResult.items || []);
      setSuscripciones(suscripcionesResult.items || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los catalogos de facturacion');
    }
  }

  async function loadFacturas() {
    setLoading(true);
    setError('');

    try {
      const result = await facturacionService.listFacturas({ empresaId, estado, limit: 100 });
      setFacturas(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las facturas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogs();
    loadFacturas();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'pagos' || tab === 'facturas') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function changeTab(tab) {
    setActiveTab(tab);
    setSearchParams(tab === 'pagos' ? { tab: 'pagos' } : {});
  }

  function openCreateForm() {
    setSelectedFactura(null);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function openEditForm(factura) {
    setSelectedFactura(factura);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedFactura(null);
    setShowForm(false);
  }

  async function saveFactura(values) {
    setFormLoading(true);
    setMessage('');
    setError('');

    try {
      if (selectedFactura) {
        await facturacionService.updateFactura(selectedFactura.id, values);
        setMessage('Factura actualizada correctamente');
        toast.success('Factura actualizada correctamente');
      } else {
        await facturacionService.createFactura(values);
        setMessage('Factura creada correctamente');
        toast.success('Factura creada correctamente');
      }

      closeForm();
      await loadFacturas();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar la factura');
    } finally {
      setFormLoading(false);
    }
  }

  async function cancelFactura(factura) {
    setMessage('');
    setError('');

    try {
      await facturacionService.anularFactura(factura.id, cancelReason);
      setMessage('Factura anulada correctamente');
      toast.success('Factura anulada correctamente');
      setCancelTarget(null);
      setCancelReason('');
      await loadFacturas();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo anular la factura');
    }
  }

  function selectFacturaForPayments(factura) {
    setSelectedFacturaId(factura.id);
    changeTab('pagos');
  }

  async function downloadPdf(factura) {
    setError('');
    try {
      const blob = await facturacionService.getFacturaPdf(factura.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'No se pudo cargar el PDF de la factura');
      setError(requestError.response?.data?.message || 'No se pudo cargar el PDF de la factura');
    }
  }

  return (
    <>
      <PageHeader
        title="Facturacion"
        description="Facturas, suscripcion vigente y pagos manuales."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} facturas`}</span>
            {isSuperAdmin ? (
              <button className="outline-button" type="button" onClick={openCreateForm}>
                <Plus size={16} />
                Nueva factura
              </button>
            ) : null}
          </>
        }
      />

      <section className="metrics-grid">
        <MetricCard label="Facturado" value={money(totals.facturado)} icon={FileText} />
        <MetricCard label="Pagado" value={money(totals.pagado)} icon={CreditCard} tone="success" />
        <MetricCard label="Pendiente" value={money(totals.pendiente)} icon={Receipt} tone="warning" />
      </section>

      <div className="panel">
        <PanelTitle title="Suscripcion" subtitle="Estado vigente de la empresa" />
        {activeSubscription ? (
          <div className="settings-grid">
            <label>
              Plan
              <strong>{activeSubscription.plan_nombre || '-'}</strong>
            </label>
            <label>
              Estado
              <span className={statusClass(activeSubscription.estado)}>{activeSubscription.estado}</span>
            </label>
            <label>
              Vigencia
              <strong>
                {dateOnly(activeSubscription.fecha_inicio)} / {dateOnly(activeSubscription.fecha_fin)}
              </strong>
            </label>
            <label>
              Monto mensual
              <strong>{money(activeSubscription.monto_mensual)}</strong>
            </label>
          </div>
        ) : (
          <div className="alert-error">No hay suscripcion registrada para mostrar.</div>
        )}
      </div>

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Filtra facturas por empresa y estado" />
        <div className="toolbar-grid">
          {isSuperAdmin ? (
            <select value={empresaId} onChange={(event) => setEmpresaId(event.target.value)}>
              <option value="">Todas las empresas</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="vencida">Vencida</option>
            <option value="anulada">Anulada</option>
          </select>
          <button className="outline-button" type="button" onClick={loadFacturas}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      <div className="tab-bar">
        <button className={activeTab === 'facturas' ? 'tab-button active' : 'tab-button'} type="button" onClick={() => changeTab('facturas')}>
          Facturas
        </button>
        <button className={activeTab === 'pagos' ? 'tab-button active' : 'tab-button'} type="button" onClick={() => changeTab('pagos')}>
          Pagos
        </button>
      </div>

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <ActionDialog
        open={Boolean(cancelTarget)}
        danger
        title="Anular factura"
        message={`Confirma la anulacion de la factura ${cancelTarget?.numero || ''}.`}
        confirmLabel="Anular"
        reason={cancelReason}
        reasonLabel="Motivo de anulacion"
        reasonPlaceholder="Ej. Error en valores o solicitud del cliente"
        onReasonChange={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        onConfirm={() => cancelFactura(cancelTarget)}
      />

      {showForm && isSuperAdmin ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <PanelTitle title={selectedFactura ? 'Editar factura' : 'Nueva factura'} subtitle="Datos fiscales y estado de cobro" />
            <FacturaForm
              factura={selectedFactura}
              empresas={empresas}
              suscripciones={suscripciones}
              loading={formLoading}
              onCancel={closeForm}
              onSubmit={saveFactura}
            />
          </div>
        </div>
      ) : null}

      {activeTab === 'facturas' ? (
        <div className="panel">
          <PanelTitle title="Facturas registradas" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Empresa</th>
                  <th>Concepto</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Vence</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length ? (
                  facturas.map((factura) => (
                    <tr key={factura.id}>
                      <td>{factura.numero}</td>
                      <td>{factura.empresa_nombre || '-'}</td>
                      <td>{factura.concepto}</td>
                      <td>
                        <span className={statusClass(factura.estado)}>{factura.estado}</span>
                      </td>
                      <td>{money(factura.total)}</td>
                      <td>{money(factura.total_pagado)}</td>
                      <td>{dateOnly(factura.fecha_vencimiento)}</td>
                      <td>
                        <div className="row-actions">
                          {factura.tiene_pdf ? (
                            <button className="icon-button" type="button" onClick={() => downloadPdf(factura)} title="Ver Factura SRI" aria-label="Ver Factura SRI">
                              <FileText size={16} />
                            </button>
                          ) : null}
                          <button className="icon-button" type="button" onClick={() => selectFacturaForPayments(factura)} title="Historial de Pagos" aria-label="Ver pagos">
                            <CreditCard size={16} />
                          </button>
                          {factura.estado === 'pendiente' ? (
                            <Link to={`/checkout?factura_id=${factura.id}`} className="icon-button text-success" title="Pagar Factura (Checkout)" aria-label="Pagar factura">
                              <Receipt size={16} />
                            </Link>
                          ) : null}
                          {isSuperAdmin && factura.estado !== 'anulada' ? (
                            <>
                              <button className="icon-button" type="button" onClick={() => openEditForm(factura)} title="Editar factura" aria-label="Editar factura">
                                <Edit size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                type="button"
                                onClick={() => {
                                  setCancelTarget(factura);
                                  setCancelReason('');
                                }}
                                title="Anular factura"
                                aria-label="Anular factura"
                              >
                                <Ban size={16} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8">Sin facturas para mostrar.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Pagos facturas={facturas} userRole={userRole} selectedFacturaId={selectedFacturaId} onChanged={loadFacturas} />
      )}
    </>
  );
}
