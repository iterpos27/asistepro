import { useEffect, useState } from 'react';
import { Ban, Check, FileText, Paperclip, Plus, RotateCcw } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PanelTitle from '../../components/common/PanelTitle';
import * as facturacionService from '../../services/facturacionService';
import { toast } from '../../services/toastService';
import { ROLES } from '../../utils/roles';

const defaultPayment = {
  factura_id: '',
  monto: '',
  metodo: 'transferencia',
  referencia: '',
  banco: '',
  nota: '',
  pagado_en: '',
  comprobante: null,
  comprobante_nombre: '',
};

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function dateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function statusClass(estado) {
  if (estado === 'registrado') return 'status-pill';
  if (estado === 'pendiente') return 'status-pill warning';
  return 'status-pill muted';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export default function Pagos({ facturas = [], userRole, selectedFacturaId = '', onChanged }) {
  const isSuperAdmin = userRole === ROLES.SUPER_ADMIN;
  const [pagos, setPagos] = useState([]);
  const [total, setTotal] = useState(0);
  const [facturaId, setFacturaId] = useState(selectedFacturaId);
  const [showForm, setShowForm] = useState(false);
  const [payment, setPayment] = useState(defaultPayment);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  async function loadPagos(nextFacturaId = facturaId) {
    setLoading(true);
    setError('');

    try {
      const result = await facturacionService.listPagos({ facturaId: nextFacturaId, limit: 100 });
      setPagos(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFacturaId(selectedFacturaId);
    setPayment((current) => ({ ...current, factura_id: selectedFacturaId }));
    loadPagos(selectedFacturaId);
  }, [selectedFacturaId]);

  function openPaymentForm(factura) {
    setPayment({
      ...defaultPayment,
      factura_id: factura?.id || facturaId || '',
      monto: factura ? Math.max(Number(factura.total || 0) - Number(factura.total_pagado || 0), 0).toFixed(2) : '',
    });
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function closePaymentForm() {
    setShowForm(false);
    setPayment(defaultPayment);
  }

  function updatePayment(key, value) {
    setPayment((current) => ({ ...current, [key]: value }));
  }

  async function attachReceipt(file) {
    setError('');

    if (!file) {
      updatePayment('comprobante', null);
      updatePayment('comprobante_nombre', '');
      return;
    }

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('El comprobante debe ser PDF, JPG, PNG o WEBP');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('El comprobante no puede superar 2MB');
      return;
    }

    try {
      const dataBase64 = await fileToBase64(file);
      setPayment((current) => ({
        ...current,
        comprobante: {
          nombre: file.name,
          tipo: file.type,
          data_base64: dataBase64,
        },
        comprobante_nombre: file.name,
      }));
    } catch (readError) {
      setError(readError.message);
    }
  }

  async function openReceipt(pago) {
    setError('');

    try {
      const blob = await facturacionService.getPagoComprobante(pago.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo abrir el comprobante');
    }
  }

  async function savePayment(event) {
    event.preventDefault();
    setFormLoading(true);
    setError('');
    setMessage('');

    try {
      await facturacionService.registerManualPayment({
        ...payment,
        monto: Number(payment.monto),
        referencia: payment.referencia,
        banco: payment.banco,
        nota: payment.nota || null,
        pagado_en: payment.pagado_en || null,
        comprobante: payment.comprobante,
      });
      setMessage('Comprobante registrado correctamente');
      toast.success('Comprobante registrado correctamente');
      closePaymentForm();
      await loadPagos(payment.factura_id);
      await onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo registrar el pago');
    } finally {
      setFormLoading(false);
    }
  }

  async function cancelPago(pago) {
    setMessage('');
    setError('');

    try {
      await facturacionService.anularPago(pago.id, cancelReason);
      setMessage('Pago anulado correctamente');
      toast.success('Pago anulado correctamente');
      setCancelTarget(null);
      setCancelReason('');
      await loadPagos();
      await onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo anular el pago');
    }
  }

  async function approvePago(pago) {
    setMessage('');
    setError('');

    try {
      await facturacionService.aprobarPago(pago.id);
      setMessage('Pago aprobado correctamente');
      toast.success('Pago aprobado correctamente');
      await loadPagos();
      await onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo aprobar el pago');
    }
  }

  return (
    <>
      <div className="panel">
        <PanelTitle title="Pagos" subtitle="Comprobantes manuales y pagos registrados" />
        <div className="toolbar-grid">
          <select value={facturaId} onChange={(event) => setFacturaId(event.target.value)}>
            <option value="">Todas las facturas</option>
            {facturas.map((factura) => (
              <option key={factura.id} value={factura.id}>
                {factura.numero} - {factura.empresa_nombre || 'Empresa'}
              </option>
            ))}
          </select>
          <button className="outline-button" type="button" onClick={() => loadPagos()}>
            <RotateCcw size={16} />
            Aplicar
          </button>
          <button className="outline-button" type="button" onClick={() => openPaymentForm()}>
            <Plus size={16} />
            Registrar pago
          </button>
          <span className="status-pill">{loading ? 'Cargando' : `${total} pagos`}</span>
        </div>
      </div>

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <ActionDialog
        open={Boolean(cancelTarget)}
        danger
        title="Anular pago"
        message={`Confirma la anulacion del pago de la factura ${cancelTarget?.factura_numero || ''}.`}
        confirmLabel="Anular"
        reason={cancelReason}
        reasonLabel="Motivo de anulacion"
        reasonPlaceholder="Ej. Comprobante duplicado o referencia incorrecta"
        onReasonChange={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        onConfirm={() => cancelPago(cancelTarget)}
      />

      {showForm ? (
        <div className="modal-backdrop" onClick={closePaymentForm}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <PanelTitle title="Registrar comprobante" subtitle="Pago manual asociado a una factura" />
            <form className="module-form" onSubmit={savePayment}>
              <div className="form-grid">
                <label>
                  Factura
                  <select value={payment.factura_id} onChange={(event) => updatePayment('factura_id', event.target.value)} required>
                    <option value="">Selecciona factura</option>
                    {facturas
                      .filter((factura) => factura.estado !== 'anulada')
                      .map((factura) => (
                        <option key={factura.id} value={factura.id}>
                          {factura.numero} - saldo {money(Number(factura.total || 0) - Number(factura.total_pagado || 0))}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Monto
                  <input value={payment.monto} onChange={(event) => updatePayment('monto', event.target.value)} type="number" min="0.01" step="0.01" required />
                </label>
                <label>
                  Metodo
                  <select value={payment.metodo} onChange={(event) => updatePayment('metodo', event.target.value)}>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito</option>
                  </select>
                </label>
                {['transferencia', 'deposito'].includes(payment.metodo) ? (
                  <label>
                    Banco / Entidad
                    <input value={payment.banco} onChange={(event) => updatePayment('banco', event.target.value)} placeholder="Ej. Banco Pichincha" required />
                  </label>
                ) : null}
                <label>
                  Pagado en
                  <input value={payment.pagado_en} onChange={(event) => updatePayment('pagado_en', event.target.value)} type="datetime-local" />
                </label>
                <label>
                  Referencia
                  <input value={payment.referencia} onChange={(event) => updatePayment('referencia', event.target.value)} placeholder="Numero de comprobante" required />
                </label>
                <label className="wide-field">
                  Nota
                  <input value={payment.nota} onChange={(event) => updatePayment('nota', event.target.value)} placeholder="Detalle opcional" />
                </label>
                <label className="wide-field">
                  Archivo comprobante
                  <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => attachReceipt(event.target.files?.[0])} required />
                  {payment.comprobante_nombre ? <small className="helper-text">Adjunto: {payment.comprobante_nombre}</small> : null}
                </label>
              </div>
              <div className="form-actions">
                <button className="outline-button" type="button" onClick={closePaymentForm}>
                  Cancelar
                </button>
                <button className="primary-button compact" disabled={formLoading}>
                  {formLoading ? 'Registrando...' : 'Registrar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <PanelTitle title="Pagos registrados" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Monto</th>
                <th>Metodo</th>
                <th>Referencia</th>
                <th>Comprobante</th>
                <th>Estado</th>
                <th>Pagado en</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length ? (
                pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td>{pago.factura_numero || '-'}</td>
                    <td>{money(pago.monto)}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {pago.metodo} {pago.banco ? `(${pago.banco})` : ''}
                    </td>
                    <td>{pago.referencia || '-'}</td>
                    <td>
                      {pago.tiene_comprobante ? (
                        <button className="outline-button" type="button" onClick={() => openReceipt(pago)}>
                          <FileText size={16} />
                          Abrir
                        </button>
                      ) : (
                        <span className="status-pill muted">
                          <Paperclip size={12} />
                          Sin archivo
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={statusClass(pago.estado)}>{pago.estado}</span>
                    </td>
                    <td>{dateTime(pago.pagado_en)}</td>
                    <td>
                      <div className="row-actions">
                        {isSuperAdmin && pago.estado !== 'anulado' ? (
                          <>
                            {pago.estado === 'pendiente' ? (
                              <button className="icon-button" type="button" onClick={() => approvePago(pago)} aria-label="Aprobar pago">
                                <Check size={16} />
                              </button>
                            ) : null}
                            <button
                              className="icon-button danger"
                              type="button"
                              onClick={() => {
                                setCancelTarget(pago);
                                setCancelReason('');
                              }}
                              aria-label="Anular pago"
                            >
                              <Ban size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="status-pill muted">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">Sin pagos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
