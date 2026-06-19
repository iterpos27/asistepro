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
          <form className="checkout-form" onSubmit={submit}>
            <label>
              Metodo
              <select value={payment.metodo} onChange={(event) => updatePayment('metodo', event.target.value)}>
                <option value="transferencia">Transferencia bancaria</option>
                <option value="deposito">Deposito bancario</option>
              </select>
            </label>
            <label>
              Banco o entidad
              <input value={payment.banco} onChange={(event) => updatePayment('banco', event.target.value)} placeholder="Ej. Banco Pichincha" required />
            </label>
            <label>
              Numero de referencia
              <input value={payment.referencia} onChange={(event) => updatePayment('referencia', event.target.value)} placeholder="Numero de operacion" required />
            </label>
            <label>
              Nota
              <textarea value={payment.nota} onChange={(event) => updatePayment('nota', event.target.value)} placeholder="Detalle opcional" rows={3} />
            </label>
            <label>
              Comprobante
              <span className="upload-zone">
                <FileUp size={24} />
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => selectReceipt(event.target.files?.[0])} required />
                <span>{receipt?.name || 'PDF, JPG, PNG o WEBP hasta 2MB'}</span>
              </span>
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
