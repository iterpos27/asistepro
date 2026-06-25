import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { BarChart3, Eye, EyeOff, MapPin, ScanFace, ShieldCheck } from 'lucide-react';
import Feature from '../../components/common/Feature';
import { useAuthContext } from '../../context/AuthContext';
import { getDefaultRoute } from '../../utils/roles';
import { toast } from '../../services/toastService';

const loginSchema = z.object({
  email: z.string().min(1, 'Usuario o email requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuthContext();
  const [showPassword, setShowPassword] = useState(false);
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
    const user = await auth.login(values).catch((error) => {
      toast.error(error.response?.data?.message || 'No se pudo iniciar sesion');
      return null;
    });

    if (!user) return;

    navigate(getDefaultRoute(user.rol));
  }

  return (
    <main className="login-screen-centered">
      <div className="login-card-centered">
        <form className="login-form-centered" onSubmit={handleSubmit(submit)}>
          <div className="login-logo-centered">
            <div className="brand-mark-centered">
              <ScanFace size={26} />
            </div>
            <h1>AsistePro</h1>
          </div>
          <div className="login-header-centered">
            <h2>Iniciar sesión</h2>
            <p>Accede con tu cuenta corporativa.</p>
          </div>
          <label className="login-label-centered">
            Usuario o Email
            <input
              {...register('email')}
              type="text"
              autoComplete="username"
              placeholder="juan.perez o tu@empresa.com"
              className="login-input-centered"
            />
            {errors.email && <small className="field-error">{errors.email.message}</small>}
          </label>
          <label className="login-label-centered">
            Contraseña
            <div className="password-row-centered">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="********"
                className="login-input-centered"
              />
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                title="Mostrar contraseña"
                aria-label="Mostrar contraseña"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
          </label>
          <button className="primary-button-centered" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Entrar'}
          </button>
          
          <div className="login-footer-centered">
            ¿No tienes cuenta? <Link to="/register" className="register-link-centered">Regístrate aquí</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
