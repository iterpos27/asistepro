import { useEffect, useState } from 'react';
import { Building2, Calendar, CheckCircle, FileUp, Info, Landmark, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getFactura, registerManualPayment } from '../../services/facturacionService';
import { toast } from '../../services/toastService';

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el comprobante'));
    reader.readAsDataURL(file);
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const facturaId = searchParams.get('factura_id');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [factura, setFactura] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [payment, setPayment] = useState({
    metodo: 'transferencia',
    banco: '',
    referencia: '',
    nota: '',
  });

  useEffect(() => {
    if (!facturaId) {
      toast.error('Factura no especificada');
      navigate('/dashboard', { replace: true });
      return;
    }

    getFactura(facturaId)
      .then((data) => {
        setFactura(data);
        if (data.estado === 'pagada') {
          toast.info('Esta factura ya se encuentra pagada');
          navigate('/facturacion', { replace: true });
        }
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'No se pudo cargar la factura');
      })
      .finally(() => setLoading(false));
  }, [facturaId, navigate]);

  function updatePayment(key, value) {
    setPayment((current) => ({ ...current, [key]: value }));
  }

  function selectReceipt(file) {
    if (!file) {
      setReceipt(null);
      return;
    }
    if (!RECEIPT_TYPES.includes(file.type)) {
      toast.warning('El comprobante debe ser PDF, JPG, PNG o WEBP');
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.warning('El comprobante no puede superar 2MB');
      return;
    }
    setReceipt(file);
  }

  async function submit(event) {
    event.preventDefault();
    if (!receipt) {
      toast.warning('Adjunta el comprobante de la transferencia o deposito');
      return;
    }

    setSubmitting(true);
    try {
      const dataUrl = await toBase64(receipt);
      await registerManualPayment({
        factura_id: factura.id,
        monto: Number(factura.total) - Number(factura.total_pagado || 0),
        metodo: payment.metodo,
        banco: payment.banco.trim(),
        referencia: payment.referencia.trim(),
        nota: payment.nota.trim() || 'Pago de suscripcion',
        comprobante: {
          nombre: receipt.name,
          tipo: receipt.type,
          data_base64: dataUrl.split(',').pop(),
        },
      });
      setCompleted(true);
      toast.success('Comprobante registrado para revision');
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo registrar el comprobante');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-card"><span className="loader-dot" /><span>Cargando cobro...</span></div>
      </div>
    );
  }

  if (completed) {
    return (
      <main className="checkout-success-screen">
        <section className="success-modal">
          <CheckCircle size={64} className="text-success" />
          <h2>Comprobante registrado</h2>
          <p>El pago quedo pendiente de validacion por el administrador de AsistePro.</p>
          <div className="success-details-box">
            <div className="detail-row"><span>Factura</span><strong>{factura?.numero}</strong></div>
            <div className="detail-row"><span>Monto</span><strong>${Number(factura?.total).toFixed(2)}</strong></div>
            <div className="detail-row"><span>Metodo</span><strong>{payment.metodo === 'deposito' ? 'Deposito' : 'Transferencia'}</strong></div>
            <div className="detail-row"><span>Referencia</span><strong>{payment.referencia}</strong></div>
          </div>
          <button className="primary-button w-full mt-6" type="button" onClick={() => navigate('/facturacion')}>
            Volver a facturacion
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-portal-screen">
      <div className="checkout-portal-container">
        <section className="checkout-summary-panel">
          <div className="checkout-summary-header">
            <Link to="/dashboard" className="checkout-logo">
              <span className="brand-mark"><Landmark size={18} /></span>
              <strong>AsistePro Pagos</strong>
            </Link>
          </div>
          <div className="order-details-card">
            <span className="order-badge">ORDEN DE SUSCRIPCION</span>
            <h2>{factura?.concepto || 'Suscripcion mensual'}</h2>
            <div className="order-meta-info">
              <div className="meta-item"><Building2 size={16} /><span>{factura?.empresa_nombre || 'Empresa'}</span></div>
              <div className="meta-item"><Calendar size={16} /><span>Factura {factura?.numero}</span></div>
            </div>
            <hr className="divider" />
            <div className="price-pricing-breakdown">
              <div className="breakdown-row"><span>Subtotal</span><span>${Number(factura?.subtotal || 0).toFixed(2)}</span></div>
              <div className="breakdown-row"><span>Impuesto</span><span>${Number(factura?.impuesto || 0).toFixed(2)}</span></div>
              <hr className="divider-subtle" />
              <div className="breakdown-row total-row"><span>Total</span><span className="total-amount">${Number(factura?.total).toFixed(2)}</span></div>
            </div>
          </div>
          <div className="checkout-guarantee">
            <ShieldCheck size={20} className="text-success" />
            <p>El comprobante sera revisado antes de activar o renovar la suscripcion.</p>
          </div>
        </section>

        <section className="checkout-payment-panel">
          <div className="payment-method-desc">
            <h3>Transferencia o deposito</h3>
            <p>Registra los datos exactos del comprobante emitido por tu entidad financiera.</p>
          </div>

          <div className="bank-details-box" style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            color: '#d1d5db'
          }}>
            <h4 style={{ color: '#fff', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Landmark size={16} className="text-primary" /> Datos de Transferencia / Depósito
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><strong>Banco:</strong> Banco Pichincha</div>
              <div><strong>Tipo:</strong> Cuenta Corriente</div>
              <div><strong>Número:</strong> 2100256841</div>
              <div><strong>Titular:</strong> ESSART SISTEMAS S.A.</div>
              <div><strong>RUC:</strong> 1391917711001</div>
              <div><strong>Email:</strong> administracion@essart.com.ec</div>
            </div>
          </div>

          <form className="checkout-form" onSubmit={submit}>
            <label>
              <span>Método</span>
              <select value={payment.metodo} onChange={(event) => updatePayment('metodo', event.target.value)}>
                <option value="transferencia">Transferencia bancaria</option>
                <option value="deposito">Depósito bancario</option>
              </select>
            </label>
            <label>
              <span>Banco o entidad</span>
              <input value={payment.banco} onChange={(event) => updatePayment('banco', event.target.value)} placeholder="Ej. Banco Pichincha" required />
            </label>
            <label>
              <span>Número de referencia</span>
              <input value={payment.referencia} onChange={(event) => updatePayment('referencia', event.target.value)} placeholder="Número de operación" required />
            </label>
            <label>
              <span>Nota</span>
              <textarea value={payment.nota} onChange={(event) => updatePayment('nota', event.target.value)} placeholder="Detalle opcional" rows={3} />
            </label>
            <label className="file-uploader-box">
              <span>Comprobante</span>
              <div className="uploader-area-dashed">
                <FileUp size={28} className="uploader-icon" />
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => selectReceipt(event.target.files?.[0])} required />
                {receipt ? (
                  <div className="selected-file-info">
                    <strong>{receipt.name}</strong>
                    <span>{(receipt.size / 1024).toFixed(1)} KB · Cambiar archivo</span>
                  </div>
                ) : (
                  <span>Haz clic para seleccionar el archivo (PDF, JPG, PNG o WEBP hasta 2MB)</span>
                )}
              </div>
            </label>
            <div className="info-banner">
              <Info size={18} />
              <span>El registro no confirma el pago. Un superadmin debe revisar y aprobar el comprobante.</span>
            </div>
            <div className="form-actions">
              <button className="outline-button" type="button" onClick={() => navigate('/dashboard')} disabled={submitting}>Regresar</button>
              <button className="primary-button" disabled={submitting}>
                {submitting ? 'Registrando...' : 'Enviar comprobante'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
