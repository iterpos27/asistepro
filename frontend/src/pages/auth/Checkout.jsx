import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  CreditCard, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  HelpCircle, 
  Upload, 
  CheckCircle, 
  Info, 
  ArrowRight,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { getFactura, checkoutSimulado, registerManualPayment } from '../../services/facturacionService';
import { toast } from '../../services/toastService';
import { useAuthContext } from '../../context/AuthContext';

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuthContext();
  const facturaId = searchParams.get('factura_id');

  const [loading, setLoading] = useState(true);
  const [factura, setFactura] = useState(null);
  const [activeTab, setActiveTab] = useState('card'); // 'card' | 'transfer'
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successType, setSuccessType] = useState('card'); // 'card' | 'transfer'

  // Card Form State
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvc: '',
    banco: 'Stripe (Simulado)'
  });

  // Transfer Form State
  const [transferData, setTransferData] = useState({
    banco: '',
    referencia: '',
    nota: '',
  });
  const [comprobanteFile, setComprobanteFile] = useState(null);

  useEffect(() => {
    if (!facturaId) {
      toast.error('Factura no especificada.');
      navigate('/login');
      return;
    }

    getFactura(facturaId)
      .then((data) => {
        setFactura(data);
        if (data.estado === 'pagada') {
          toast.info('Esta factura ya ha sido pagada.');
          navigate('/dashboard');
        }
      })
      .catch((err) => {
        console.error('Error fetching invoice:', err);
        toast.error('No se pudo recuperar la información de cobro.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [facturaId, navigate]);

  const handleCardInputChange = (e) => {
    let { name, value } = e.target;
    if (name === 'number') {
      // Format card number: xxxx xxxx xxxx xxxx
      value = value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19);
    } else if (name === 'expiry') {
      // Format MM/YY
      value = value.replace(/\D/g, '').replace(/(\d{2})/, '$1/').substring(0, 5);
    } else if (name === 'cvc') {
      value = value.replace(/\D/g, '').substring(0, 4);
    }
    setCardData(prev => ({ ...prev, [name]: value }));
  };

  const handleTransferInputChange = (e) => {
    const { name, value } = e.target;
    setTransferData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.warning('El comprobante debe pesar menos de 2MB.');
      return;
    }

    setComprobanteFile(file);
  };

  // Convert File to Base64
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvc) {
      toast.warning('Por favor llene todos los campos de la tarjeta.');
      return;
    }

    setIsSubmitting(true);
    try {
      await checkoutSimulado({
        factura_id: factura.id,
        banco: cardData.banco || 'Tarjeta Simulado'
      });
      
      // Update session info
      await refreshProfile();
      
      setSuccessType('card');
      setPaymentSuccess(true);
      toast.success('¡Pago procesado exitosamente!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error al procesar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferData.banco.trim() || !transferData.referencia.trim()) {
      toast.warning('Por favor ingrese el banco de origen y la referencia.');
      return;
    }
    if (!comprobanteFile) {
      toast.warning('Por favor adjunte el comprobante físico.');
      return;
    }

    setIsSubmitting(true);
    try {
      const base64Data = await toBase64(comprobanteFile);
      const splitData = base64Data.split(',');
      const payload = {
        factura_id: factura.id,
        monto: Number(factura.total),
        metodo: 'transferencia',
        referencia: transferData.referencia,
        banco: transferData.banco,
        nota: transferData.nota || 'Registro manual por SaaS checkout',
        comprobante: {
          nombre: comprobanteFile.name,
          tipo: comprobanteFile.type,
          data_base64: splitData[1] // Just the raw base64 contents
        }
      };

      await registerManualPayment(payload);
      
      setSuccessType('transfer');
      setPaymentSuccess(true);
      toast.success('Comprobante registrado. Pendiente de aprobación.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error al subir el comprobante.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-card">
          <span className="loader-dot" />
          <span>Cargando cobro...</span>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <main className="checkout-success-screen">
        <div className="success-modal">
          <div className="success-icon-wrapper">
            <CheckCircle size={64} className="text-success" />
          </div>
          
          {successType === 'card' ? (
            <>
              <h2>¡Pago Procesado con Éxito!</h2>
              <p>Tu suscripción se encuentra activa y tu cuenta corporativa ha sido habilitada inmediatamente.</p>
              <div className="success-details-box">
                <div className="detail-row">
                  <span>Factura N°:</span>
                  <strong>{factura?.numero}</strong>
                </div>
                <div className="detail-row">
                  <span>Monto Pagado:</span>
                  <strong className="text-success">${Number(factura?.total).toFixed(2)}</strong>
                </div>
                <div className="detail-row">
                  <span>Método de Pago:</span>
                  <span>Tarjeta de Crédito</span>
                </div>
              </div>
              <button onClick={() => navigate('/dashboard')} className="primary-button w-full mt-6">
                Ir al Panel Principal Operativo
              </button>
            </>
          ) : (
            <>
              <h2>¡Comprobante Registrado!</h2>
              <p>Hemos recibido tu comprobante de transferencia. Nuestro equipo administrativo validará el depósito en las próximas horas.</p>
              <div className="info-banner mt-4">
                <Info size={18} className="text-blue" />
                <span>Tu cuenta se habilitará una vez que el pago sea aprobado por el administrador.</span>
              </div>
              <div className="success-details-box mt-4">
                <div className="detail-row">
                  <span>Factura N°:</span>
                  <strong>{factura?.numero}</strong>
                </div>
                <div className="detail-row">
                  <span>Monto Registrado:</span>
                  <strong>${Number(factura?.total).toFixed(2)}</strong>
                </div>
                <div className="detail-row">
                  <span>Banco Emisor:</span>
                  <span>{transferData.banco}</span>
                </div>
                <div className="detail-row">
                  <span>Referencia:</span>
                  <span>{transferData.referencia}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-6 w-full">
                <button onClick={() => navigate('/dashboard')} className="primary-button w-full">
                  Ir al Dashboard (Modo Consulta)
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-portal-screen">
      <div className="checkout-portal-container">
        
        {/* Left Column: Order Summary */}
        <section className="checkout-summary-panel">
          <div className="checkout-summary-header">
            <Link to="/" className="checkout-logo">
              <span className="brand-mark"><CreditCard size={18} /></span>
              <strong>AsistePro Checkout</strong>
            </Link>
          </div>

          <div className="order-details-card">
            <span className="order-badge">ORDEN DE SUSCRIPCIÓN</span>
            <h2>{factura?.concepto || 'Suscripción Mensual'}</h2>
            
            <div className="order-meta-info">
              <div className="meta-item">
                <Building2 size={16} />
                <span>Empresa: {factura?.empresa_nombre || 'Nueva Empresa'}</span>
              </div>
              <div className="meta-item">
                <Calendar size={16} />
                <span>Periodo: 30 Días</span>
              </div>
            </div>

            <hr className="divider" />

            <div className="price-pricing-breakdown">
              <div className="breakdown-row">
                <span>Subtotal</span>
                <span>${Number(factura?.subtotal || factura?.total).toFixed(2)}</span>
              </div>
              <div className="breakdown-row">
                <span>Impuesto (0%)</span>
                <span>$0.00</span>
              </div>
              <hr className="divider-subtle" />
              <div className="breakdown-row total-row">
                <span>Total a Pagar</span>
                <span className="total-amount">${Number(factura?.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="invoice-meta-tag">
              <span className="info-icon"><Info size={14} /></span>
              <span>Factura N°: {factura?.numero} · Vence en 5 días</span>
            </div>
          </div>

          <div className="checkout-guarantee">
            <ShieldCheck size={20} className="text-success" />
            <p>Conexión segura SSL. Tus datos personales y de facturación están completamente encriptados.</p>
          </div>
        </section>

        {/* Right Column: Payment Form */}
        <section className="checkout-payment-panel">
          <div className="payment-tabs-nav">
            <button 
              type="button"
              className={`payment-tab-btn ${activeTab === 'card' ? 'active' : ''}`}
              onClick={() => setActiveTab('card')}
            >
              <CreditCard size={18} />
              <span>Tarjeta de Crédito</span>
            </button>
            <button 
              type="button"
              className={`payment-tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
              onClick={() => setActiveTab('transfer')}
            >
              <Upload size={18} />
              <span>Transferencia o Depósito</span>
            </button>
          </div>

          <div className="payment-tab-content">
            {/* CARD MODE */}
            {activeTab === 'card' && (
              <form onSubmit={handleCardSubmit} className="checkout-form">
                <div className="payment-method-desc">
                  <h3>Pago Simulado con Tarjeta</h3>
                  <p>Ingrese cualquier número de tarjeta para simular una pasarela de pago (Stripe/PayPhone) aprobada automáticamente.</p>
                </div>

                {/* Simulated Credit Card Visual */}
                <div className="visual-card-mockup">
                  <div className="card-mockup-chip" />
                  <div className="card-mockup-number">
                    {cardData.number || '•••• •••• •••• ••••'}
                  </div>
                  <div className="card-mockup-footer">
                    <div className="card-holder">
                      <span className="card-label">TITULAR</span>
                      <span className="card-value">{cardData.name.toUpperCase() || 'NOMBRE APELLIDO'}</span>
                    </div>
                    <div className="card-expiry">
                      <span className="card-label">VENCE</span>
                      <span className="card-value">{cardData.expiry || 'MM/YY'}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <span>Nombre en la Tarjeta</span>
                    <input 
                      type="text" 
                      name="name" 
                      placeholder="Ej. Juan Pérez" 
                      value={cardData.name}
                      onChange={handleCardInputChange}
                      required 
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <span>Número de Tarjeta</span>
                    <input 
                      type="text" 
                      name="number" 
                      placeholder="4000 1234 5678 9010" 
                      value={cardData.number}
                      onChange={handleCardInputChange}
                      required 
                    />
                  </label>
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label>
                      <span>Vencimiento</span>
                      <input 
                        type="text" 
                        name="expiry" 
                        placeholder="MM/YY" 
                        value={cardData.expiry}
                        onChange={handleCardInputChange}
                        required 
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      <span>CVC / CVV</span>
                      <input 
                        type="password" 
                        name="cvc" 
                        placeholder="123" 
                        value={cardData.cvc}
                        onChange={handleCardInputChange}
                        required 
                      />
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <span>Banco Emisor (Simulado)</span>
                    <select 
                      name="banco" 
                      value={cardData.banco} 
                      onChange={handleCardInputChange}
                    >
                      <option value="Stripe (Simulado)">Stripe Gateway</option>
                      <option value="PayPhone (Simulado)">PayPhone Ecuador</option>
                      <option value="Banco Guayaquil (Simulado)">Banco Guayaquil</option>
                      <option value="Banco Pichincha (Simulado)">Banco Pichincha</option>
                    </select>
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="primary-button w-full mt-6 flex items-center justify-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Procesando Pago Seguro...' : `Pagar $${Number(factura?.total).toFixed(2)}`}
                </button>
              </form>
            )}

            {/* TRANSFER MODE */}
            {activeTab === 'transfer' && (
              <form onSubmit={handleTransferSubmit} className="checkout-form">
                <div className="payment-method-desc">
                  <h3>Depósito o Transferencia Directa</h3>
                  <p>Realice la transferencia a una de nuestras cuentas y suba una captura o PDF del comprobante para activarlo manualmente.</p>
                </div>

                <div className="bank-accounts-info-box">
                  <h4>Nuestras Cuentas Bancarias:</h4>
                  <div className="bank-account-item">
                    <h5>Banco Pichincha (Cuenta Corriente)</h5>
                    <p>N° Cuenta: <strong>2201948291</strong></p>
                    <p>Beneficiario: <strong>AsistePro S.A.</strong></p>
                    <p>RUC: <strong>1793847291001</strong></p>
                    <p>Email: <strong>pagos@asistepro.com</strong></p>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <span>Banco de Origen (Desde donde transfiere) *</span>
                    <input 
                      type="text" 
                      name="banco" 
                      placeholder="Ej. Banco Guayaquil, Produbanco" 
                      value={transferData.banco}
                      onChange={handleTransferInputChange}
                      required 
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <span>Número de Referencia / Transacción *</span>
                    <input 
                      type="text" 
                      name="referencia" 
                      placeholder="Ej. N° de documento o lote" 
                      value={transferData.referencia}
                      onChange={handleTransferInputChange}
                      required 
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <span>Notas / Observación Adicional</span>
                    <textarea 
                      name="nota" 
                      placeholder="Detalles adicionales sobre el depósito..." 
                      value={transferData.nota}
                      onChange={handleTransferInputChange}
                      rows={2}
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label className="file-uploader-box">
                    <span className="file-uploader-title">Adjuntar Comprobante (Imagen o PDF) *</span>
                    <div className="uploader-area-dashed">
                      <Upload size={24} className="uploader-icon" />
                      {comprobanteFile ? (
                        <div className="selected-file-info">
                          <strong>{comprobanteFile.name}</strong>
                          <span>({(comprobanteFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      ) : (
                        <span>Haga clic para seleccionar o arrastre el archivo aquí (Máx. 2MB)</span>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      required
                    />
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="primary-button w-full mt-6 flex items-center justify-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registrando Comprobante...' : 'Registrar Comprobante'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
