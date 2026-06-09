import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { BarChart3, Eye, EyeOff, MapPin, ScanFace, ShieldCheck } from 'lucide-react';
import Feature from '../../components/common/Feature';
import { useAuthContext } from '../../context/AuthContext';
import { getDefaultRoute } from '../../utils/roles';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Password requerido'),
});

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuthContext();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function submit(values) {
    setServerError('');
    const user = await auth.login(values).catch((error) => {
      setServerError(error.response?.data?.message || 'No se pudo iniciar sesion');
      return null;
    });

    if (!user) return;

    navigate(getDefaultRoute(user.rol));
  }

  return (
    <main className="login-screen">
      <section className="login-brand">
        <div className="brand-row">
          <div className="brand-mark">
            <ScanFace size={24} />
          </div>
          <strong>AsistePro</strong>
        </div>
        <div>
          <h1>Asistencia multi-sucursal con QR y GPS.</h1>
          <p>Gestiona empresas, empleados, horarios y reportes desde una plataforma SaaS segura.</p>
        </div>
        <div className="brand-highlights">
          <Feature icon={MapPin} title="Geocercas" text="Validacion por radio y ubicacion real." />
          <Feature icon={ShieldCheck} title="Multi tenant" text="Datos aislados por empresa." />
          <Feature icon={BarChart3} title="Reportes" text="Asistencia diaria, mensual y novedades." />
        </div>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit(submit)}>
          <div className="mobile-brand">
            <div className="brand-mark">
              <ScanFace size={20} />
            </div>
            <strong>AsistePro</strong>
          </div>
          <div>
            <h2>Iniciar sesion</h2>
            <p>Accede con tu cuenta corporativa.</p>
          </div>
          <label>
            Email
            <input {...register('email')} type="email" autoComplete="email" placeholder="tu@empresa.com" />
            {errors.email && <small className="field-error">{errors.email.message}</small>}
          </label>
          <label>
            Contrasena
            <div className="password-row">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="********"
              />
              <button className="icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar contrasena">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
          </label>
          {serverError && <div className="alert-error">{serverError}</div>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
