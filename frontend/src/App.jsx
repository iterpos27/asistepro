import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  ScanFace,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, clearSession, getStoredUser, setSession } from './services/api';
import { branchActivity, weeklyAttendance } from './data/fallback';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Password requerido'),
});

const navItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Empresas', href: '/empresas', icon: Building2 },
  { title: 'Sucursales', href: '/sucursales', icon: MapPin },
  { title: 'Empleados', href: '/empleados', icon: Users },
  { title: 'Horarios', href: '/horarios', icon: CalendarClock },
  { title: 'Marcaciones', href: '/marcaciones', icon: Activity },
  { title: 'Reportes', href: '/reportes', icon: FileBarChart },
  { title: 'Facturacion', href: '/facturacion', icon: CreditCard },
  { title: 'Ajustes', href: '/settings', icon: Settings },
];

function useAuth() {
  const [user, setUser] = useState(() => getStoredUser());

  return {
    user,
    setUser,
    isAuthenticated: Boolean(localStorage.getItem('asistepro_access_token')),
  };
}

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'superadmin@asistepro.local',
      password: 'Admin123*',
    },
  });

  async function submit(values) {
    setServerError('');
    const response = await api.post('/auth/login', values).catch((error) => {
      setServerError(error.response?.data?.message || 'No se pudo iniciar sesion');
      return null;
    });

    if (!response) return;

    const { user, tokens } = response.data.data;
    setSession({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    });
    onLogin(user);
    navigate('/admin');
  }

  return (
    <main className="login-screen">
      <section className="login-brand">
        <div className="brand-mark">
          <ScanFace size={24} />
          <span>AsistePro</span>
        </div>
        <div>
          <h1>Control de asistencia multi-sucursal con QR + GPS.</h1>
          <p>
            Gestiona empresas, sucursales, empleados, horarios, marcaciones y reportes desde una consola SaaS.
          </p>
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
            <ScanFace size={22} />
            <span>AsistePro</span>
          </div>
          <div>
            <h2>Iniciar sesion</h2>
            <p>Accede a tu panel operativo.</p>
          </div>
          <label>
            Email
            <input {...register('email')} type="email" autoComplete="email" />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
          <label>
            Password
            <div className="password-row">
              <input {...register('password')} type={showPassword ? 'text' : 'password'} />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {errors.password && <small>{errors.password.message}</small>}
          </label>
          {serverError && <div className="alert-error">{serverError}</div>}
          <button className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="feature">
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function AppShell({ user, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function logout() {
    clearSession();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-brand">
          <ScanFace size={22} />
          <div>
            <strong>AsistePro</strong>
            <span>Attendance OS</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} className={active ? 'nav-link active' : 'nav-link'} to={item.href} onClick={() => setOpen(false)}>
                <Icon size={18} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="content-area">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <strong>AsistePro</strong>
            <span>{user?.email || 'Sesion activa'}</span>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Buscar empleados, sucursales..." />
          </div>
          <button className="outline-button" onClick={logout}>
            <LogOut size={16} />
            Salir
          </button>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

function Protected({ auth, children }) {
  if (!auth.isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone = 'primary', detail }) {
  return (
    <div className="metric-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
      <div className={`metric-icon ${tone}`}>
        <Icon size={22} />
      </div>
    </div>
  );
}

function useResource(path, fallback, deps = []) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get(path)
      .then((response) => {
        if (mounted) setData(response.data.data);
      })
      .catch(() => {
        if (mounted) setData(fallback);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, deps);

  return { data, loading };
}

function DashboardPage() {
  const empresas = useResource('/empresas?limit=100', { items: [], total: 0 });
  const planes = useResource('/planes', []);
  const facturas = useResource('/facturacion/facturas?limit=100', { items: [], total: 0 });
  const marcaciones = useResource('/marcaciones?limit=100', { items: [], total: 0 });
  const reportes = useResource('/reportes/novedades?limit=10', { items: [], total: 0 });

  const invoiceTotal = Array.isArray(facturas.data.items)
    ? facturas.data.items.reduce((total, item) => total + Number(item.total || 0), 0)
    : 0;

  return (
    <>
      <PageHeader title="Dashboard final" description="KPIs operativos, facturacion y asistencia en tiempo real." />
      <section className="metrics-grid">
        <MetricCard label="Empresas" value={empresas.data.total || empresas.data.items?.length || 0} icon={Building2} />
        <MetricCard label="Planes activos" value={Array.isArray(planes.data) ? planes.data.filter((p) => p.activo).length : 0} icon={CreditCard} tone="success" />
        <MetricCard label="Marcaciones" value={marcaciones.data.total || 0} icon={UserCheck} tone="accent" />
        <MetricCard label="Facturacion" value={`$${invoiceTotal.toFixed(2)}`} icon={BarChart3} tone="warning" />
      </section>
      <section className="dashboard-grid">
        <div className="panel wide">
          <PanelTitle title="Asistencia semanal" subtitle="Vista de referencia del diseno original" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyAttendance}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="presentes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tarde" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ausentes" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <PanelTitle title="Sucursales" subtitle="Actividad por ubicacion" />
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={branchActivity} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
                {branchActivity.map((_, index) => (
                  <Cell key={index} fill={['#4f46e5', '#10b981', '#06b6d4', '#f59e0b'][index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <DataPanel title="Novedades recientes" rows={reportes.data.items || []} columns={['empleado_codigo', 'motivo_novedad', 'sucursal_nombre']} />
        <DataPanel title="Empresas recientes" rows={empresas.data.items || []} columns={['nombre', 'estado', 'email']} />
      </section>
    </>
  );
}

function PanelTitle({ title, subtitle }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

function DataPanel({ title, rows, columns }) {
  return (
    <div className="panel">
      <PanelTitle title={title} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.slice(0, 8).map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map((column) => (
                    <td key={column}>{String(row[column] ?? '-')}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>Sin datos para mostrar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResourcePage({ title, description, path, columns }) {
  const { data, loading } = useResource(path, { items: [], total: 0 }, [path]);

  return (
    <>
      <PageHeader title={title} description={description} actions={<span className="status-pill">{loading ? 'Cargando' : `${data.total || data.items?.length || 0} registros`}</span>} />
      <DataPanel title={title} rows={data.items || []} columns={columns} />
    </>
  );
}

function ReportsPage() {
  const diaria = useResource(`/reportes/asistencia-diaria?fecha=${new Date().toISOString().slice(0, 10)}`, { resumen: {}, items: [] });
  const mensual = useResource(`/reportes/asistencia-mensual?mes=${new Date().toISOString().slice(0, 7)}`, { resumen: {}, items: [] });
  const [csvStatus, setCsvStatus] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  async function downloadDailyCsv() {
    try {
      setCsvStatus('Preparando CSV');
      const response = await api.get(`/reportes/export/asistencia-diaria.csv?fecha=${today}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asistencia-diaria-${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setCsvStatus('CSV descargado');
    } catch {
      setCsvStatus('No se pudo descargar');
    }
  }

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Asistencia diaria, mensual, novedades y exportaciones."
        actions={
          <>
            <button className="outline-button" type="button" onClick={downloadDailyCsv}>
              CSV diario
            </button>
            {csvStatus ? <span className="status-pill muted">{csvStatus}</span> : null}
          </>
        }
      />
      <section className="metrics-grid">
        <MetricCard label="Presentes hoy" value={diaria.data.resumen?.presentes || 0} icon={UserCheck} tone="success" />
        <MetricCard label="Ausentes hoy" value={diaria.data.resumen?.ausentes || 0} icon={Users} tone="warning" />
        <MetricCard label="Marcaciones mes" value={mensual.data.resumen?.total_marcaciones || 0} icon={Activity} />
        <MetricCard label="Novedades mes" value={mensual.data.resumen?.novedades || 0} icon={FileBarChart} tone="accent" />
      </section>
      <DataPanel title="Asistencia diaria" rows={diaria.data.items || []} columns={['empleado_codigo', 'empleado_nombres', 'estado_asistencia', 'novedades']} />
    </>
  );
}

function SettingsPage() {
  const user = getStoredUser();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  return (
    <>
      <PageHeader title="Ajustes" description="Configuracion local del panel React/Vite." />
      <div className="panel">
        <PanelTitle title="Sesion" subtitle="Datos almacenados localmente" />
        <div className="settings-grid">
          <label>
            API URL
            <input readOnly value={apiUrl} />
          </label>
          <label>
            Usuario
            <input readOnly value={user?.email || ''} />
          </label>
          <label>
            Empresa seleccionada
            <input
              defaultValue={localStorage.getItem('asistepro_empresa_id') || ''}
              onBlur={(event) => localStorage.setItem('asistepro_empresa_id', event.target.value)}
              placeholder="Necesario para SUPER_ADMIN en rutas tenant"
            />
          </label>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const auth = useAuth();

  return (
    <Routes>
      <Route path="/" element={auth.isAuthenticated ? <Navigate to="/admin" replace /> : <LoginPage onLogin={auth.setUser} />} />
      <Route
        path="/*"
        element={
          <Protected auth={auth}>
            <AppShell user={auth.user}>
              <Routes>
                <Route path="/admin" element={<DashboardPage />} />
                <Route path="/empresas" element={<ResourcePage title="Empresas" description="Gestion de tenants SaaS." path="/empresas?limit=100" columns={['nombre', 'estado', 'email', 'identificacion_fiscal']} />} />
                <Route path="/sucursales" element={<ResourcePage title="Sucursales" description="Ubicaciones, geocercas y QR." path="/sucursales?limit=100" columns={['nombre', 'codigo', 'ciudad', 'radio_metros', 'estado']} />} />
                <Route path="/empleados" element={<ResourcePage title="Empleados" description="Directorio por empresa." path="/empleados?limit=100" columns={['codigo', 'nombres', 'apellidos', 'cargo', 'estado']} />} />
                <Route path="/horarios" element={<ResourcePage title="Horarios" description="Turnos y asignaciones." path="/horarios?limit=100" columns={['nombre', 'hora_inicio', 'hora_fin', 'tolerancia_minutos', 'activo']} />} />
                <Route path="/marcaciones" element={<ResourcePage title="Marcaciones" description="Historial QR + GPS." path="/marcaciones?limit=100" columns={['empleado_codigo', 'sucursal_nombre', 'tipo', 'estado', 'marcado_en']} />} />
                <Route path="/facturacion" element={<ResourcePage title="Facturacion" description="Facturas y pagos manuales." path="/facturacion/facturas?limit=100" columns={['numero', 'empresa_nombre', 'estado', 'total', 'total_pagado']} />} />
                <Route path="/reportes" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  );
}
