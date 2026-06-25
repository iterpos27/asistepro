import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  ScanFace
} from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { listPublicPlanes } from '../../services/planService';
import { toast } from '../../services/toastService';
import { getDefaultRoute } from '../../utils/roles';

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuthContext();
  
  const [step, setStep] = useState(1);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nombre: '',
    identificacion_fiscal: '',
    email: '',
    telefono: '',
    direccion: '',
    plan_id: '',
    admin_nombre: '',
    admin_apellido: '',
    admin_email: '',
    admin_cedula: '',
    admin_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    listPublicPlanes()
      .then((data) => {
        // Find the free plan (starter)
        const starter = data.find(p => p.codigo === 'starter');
        if (starter) {
          setFormData(prev => ({ ...prev, plan_id: starter.id }));
        } else {
          const active = data.filter(p => p.activo);
          if (active[0]) {
            setFormData(prev => ({ ...prev, plan_id: active[0].id }));
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching plans:', err);
        toast.error('No se pudieron cargar los planes de suscripción.');
      })
      .finally(() => {
        setLoadingPlanes(false);
      });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.nombre.trim()) {
        toast.error('El nombre de la empresa es requerido.');
        return false;
      }
      if (!formData.identificacion_fiscal.trim()) {
        toast.error('La identificación fiscal (RUC / NIT) es requerida.');
        return false;
      }
      if (!formData.email.trim()) {
        toast.error('El email de la empresa es requerido.');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        toast.error('El email de la empresa no es válido.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations for step 2
    if (!formData.admin_nombre.trim()) {
      toast.error('El nombre del administrador es requerido.');
      return;
    }
    if (!formData.admin_apellido.trim()) {
      toast.error('El apellido del administrador es requerido.');
      return;
    }
    if (!formData.admin_email.trim()) {
      toast.error('El email del administrador es requerido.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.admin_email.trim())) {
      toast.error('El email del administrador no es válido.');
      return;
    }
    if (!formData.admin_cedula.trim()) {
      toast.error('La cédula del administrador es requerida.');
      return;
    }
    if (formData.admin_password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (formData.admin_password !== formData.confirm_password) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    if (!formData.plan_id) {
      toast.error('Error al asociar el plan gratuito. Por favor intente recargando la página.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        nombre: formData.nombre,
        identificacion_fiscal: formData.identificacion_fiscal,
        email: formData.email,
        telefono: formData.telefono || null,
        direccion: formData.direccion || null,
        plan_id: formData.plan_id,
        admin_nombre: formData.admin_nombre,
        admin_apellido: formData.admin_apellido,
        admin_email: formData.admin_email,
        admin_cedula: formData.admin_cedula,
        admin_password: formData.admin_password,
      };

      const result = await auth.registerTenant(payload);
      toast.success('¡Registro exitoso! Bienvenido a AsistePro.');
      navigate(getDefaultRoute(result.user?.rol), { replace: true });
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(err.response?.data?.message || 'Error al registrar la empresa. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-screen register-container">
      {/* Brand & Left Side Panel */}
      <section className="login-brand register-brand">
        <div className="brand-row">
          <div className="brand-mark">
            <ScanFace size={24} />
          </div>
          <strong>AsistePro</strong>
        </div>
        
        <div className="register-welcome">
          <h1>Comienza gratis y escala cuando quieras.</h1>
          <p>Controla asistencia, geocercas, horarios rotativos y genera reportes en tiempo real para tu negocio.</p>
          
          <div className="registration-steps-indicator">
            <div className={`step-badge ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
              <span className="step-num">{step > 1 ? <CheckCircle2 size={16} /> : '1'}</span>
              <span className="step-label">Datos de Empresa</span>
            </div>
            <div className={`step-line ${step > 1 ? 'completed' : ''}`} />
            <div className={`step-badge ${step === 2 ? 'active' : ''}`}>
              <span className="step-num">2</span>
              <span className="step-label">Administrador</span>
            </div>
          </div>
        </div>

        <div className="brand-footer-text">
          <p>¿Ya tienes cuenta? <Link to="/login" className="accent-link">Inicia sesión aquí</Link></p>
        </div>
      </section>

      {/* Main Form Panel */}
      <section className="login-panel register-panel">
        <div className="register-card">
          <div className="mobile-brand">
            <div className="brand-mark">
              <ScanFace size={20} />
            </div>
            <strong>AsistePro</strong>
          </div>

          <div className="register-header">
            <h2>Crear nueva cuenta</h2>
            <p>Paso {step} de 2: {step === 1 ? 'Cuéntanos sobre tu empresa' : 'Registra al usuario administrador'}</p>
          </div>

          {loadingPlanes ? (
            <div className="planes-loading">
              <span className="loader-dot" />
              <p>Preparando entorno de registro...</p>
            </div>
          ) : (
            <>
              {/* STEP 1: COMPANY DATA */}
              {step === 1 && (
                <div className="step-content">
                  <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="register-form-step">
                    <label>
                      <span className="label-text">Nombre de la Empresa *</span>
                      <div className="input-with-icon">
                        <Building2 className="input-icon" size={18} />
                        <input 
                          type="text" 
                          name="nombre" 
                          placeholder="Ej. Mi Negocio S.A." 
                          value={formData.nombre}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <label>
                      <span className="label-text">Identificación Fiscal (RUC / NIT) *</span>
                      <div className="input-with-icon">
                        <Building2 className="input-icon" size={18} />
                        <input 
                          type="text" 
                          name="identificacion_fiscal" 
                          placeholder="Ej. 1792948271001" 
                          value={formData.identificacion_fiscal}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <label>
                      <span className="label-text">Email de la Empresa *</span>
                      <div className="input-with-icon">
                        <Mail className="input-icon" size={18} />
                        <input 
                          type="email" 
                          name="email" 
                          placeholder="contacto@empresa.com" 
                          value={formData.email}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <div className="form-row-2col">
                      <label>
                        <span className="label-text">Teléfono</span>
                        <div className="input-with-icon">
                          <Phone className="input-icon" size={18} />
                          <input 
                            type="text" 
                            name="telefono" 
                            placeholder="Ej. 0999999999" 
                            value={formData.telefono}
                            onChange={handleInputChange}
                          />
                        </div>
                      </label>

                      <label>
                        <span className="label-text">Dirección</span>
                        <div className="input-with-icon">
                          <MapPin className="input-icon" size={18} />
                          <input 
                            type="text" 
                            name="direccion" 
                            placeholder="Ej. Av. Central 456" 
                            value={formData.direccion}
                            onChange={handleInputChange}
                          />
                        </div>
                      </label>
                    </div>

                    <div className="register-actions">
                      <Link to="/login" className="secondary-button text-center">
                        Cancelar
                      </Link>
                      <button type="submit" className="primary-button inline-flex items-center justify-center gap-2">
                        Siguiente <ArrowRight size={16} />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 2: ADMINISTRATOR ACCOUNT */}
              {step === 2 && (
                <div className="step-content">
                  <form onSubmit={handleSubmit} className="register-form-step">
                    <div className="form-row-2col">
                      <label>
                        <span className="label-text">Nombre Administrador *</span>
                        <div className="input-with-icon">
                          <User className="input-icon" size={18} />
                          <input 
                            type="text" 
                            name="admin_nombre" 
                            placeholder="Nombre" 
                            value={formData.admin_nombre}
                            onChange={handleInputChange}
                            required 
                          />
                        </div>
                      </label>

                      <label>
                        <span className="label-text">Apellido Administrador *</span>
                        <div className="input-with-icon">
                          <User className="input-icon" size={18} />
                          <input 
                            type="text" 
                            name="admin_apellido" 
                            placeholder="Apellido" 
                            value={formData.admin_apellido}
                            onChange={handleInputChange}
                            required 
                          />
                        </div>
                      </label>
                    </div>

                    <label>
                      <span className="label-text">Email de Acceso *</span>
                      <div className="input-with-icon">
                        <Mail className="input-icon" size={18} />
                        <input 
                          type="email" 
                          name="admin_email" 
                          placeholder="admin@empresa.com" 
                          value={formData.admin_email}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <label>
                      <span className="label-text">Número de Cédula *</span>
                      <div className="input-with-icon">
                        <User className="input-icon" size={18} />
                        <input 
                          type="text" 
                          name="admin_cedula" 
                          placeholder="Ej. 1792948271" 
                          value={formData.admin_cedula}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <label>
                      <span className="label-text">Contraseña (Mín. 8 caracteres) *</span>
                      <div className="input-with-icon">
                        <Lock className="input-icon" size={18} />
                        <input 
                          type="password" 
                          name="admin_password" 
                          placeholder="********" 
                          value={formData.admin_password}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <label>
                      <span className="label-text">Confirmar Contraseña *</span>
                      <div className="input-with-icon">
                        <Lock className="input-icon" size={18} />
                        <input 
                          type="password" 
                          name="confirm_password" 
                          placeholder="********" 
                          value={formData.confirm_password}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </label>

                    <div className="register-actions">
                      <button 
                        type="button" 
                        onClick={handleBack} 
                        className="secondary-button inline-flex items-center justify-center gap-2"
                        disabled={isSubmitting}
                      >
                        <ArrowLeft size={16} /> Atrás
                      </button>
                      <button 
                        type="submit" 
                        className="primary-button inline-flex items-center justify-center gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Registrando...' : 'Finalizar Registro'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
