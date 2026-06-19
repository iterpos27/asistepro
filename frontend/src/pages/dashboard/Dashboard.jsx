import { lazy, Suspense } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileBarChart,
  MapPin,
  UserCheck,
  Users,
} from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import DataPanel from '../../components/tables/DataPanel';
import { useAuthContext } from '../../context/AuthContext';
import useResource from '../../hooks/useResource';
import { ROLES, getRoleLabel } from '../../utils/roles';

const DashboardChart = lazy(() => import('./DashboardChart'));

function ChartFallback({ height }) {
  return <div className="chart-loading" style={{ height }} aria-label="Cargando grafico" />;
}

function getTotal(data) {
  if (Array.isArray(data)) return data.length;
  return data?.total || data?.items?.length || 0;
}

function getRows(data) {
  if (Array.isArray(data)) return data;
  return data?.items || [];
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function dayLabel(value) {
  return value ? String(value).slice(5, 10) : '-';
}

function buildMonthlyAttendance(rows) {
  return rows.map((row) => ({
    day: dayLabel(row.fecha),
    presentes: Number(row.empleados_presentes || 0),
    novedades: Number(row.novedades || 0),
    rechazadas: Number(row.rechazadas || 0),
  }));
}

function buildBranchActivity(rows) {
  const grouped = rows.reduce((summary, row) => {
    const name = row.sucursal_nombre || 'Sin sucursal';
    summary[name] = (summary[name] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

function buildSubscriptionsByPlan(rows) {
  const grouped = rows.reduce((summary, row) => {
    const name = row.plan_nombre || 'Sin plan';
    summary[name] = (summary[name] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

function buildPaymentsByMethod(rows) {
  const grouped = rows.reduce((summary, row) => {
    const name = row.metodo || 'Otro';
    summary[name] = (summary[name] || 0) + Number(row.monto || 0);
    return summary;
  }, {});

  return Object.entries(grouped).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
}

export default function Dashboard() {
  const { user } = useAuthContext();
  const role = user?.rol || ROLES.EMPLEADO;
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isAdminEmpresa = role === ROLES.ADMIN_EMPRESA;
  const isRrhh = role === ROLES.RRHH;
  const isEmpleado = role === ROLES.EMPLEADO;
  const canSeeTenantOps = isAdminEmpresa || isRrhh;
  const canSeeAttendance = isAdminEmpresa || isRrhh || isEmpleado;

  const empresas = useResource('/empresas?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const planes = useResource('/planes', [], [role], { enabled: isSuperAdmin });
  const suscripciones = useResource('/suscripciones?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const facturas = useResource('/facturacion/facturas?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const pagos = useResource('/facturacion/pagos?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const sucursales = useResource('/sucursales?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeTenantOps });
  const empleados = useResource('/empleados?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeTenantOps });
  const horarios = useResource('/horarios?limit=100', { items: [], total: 0 }, [role], { enabled: isAdminEmpresa });
  const marcaciones = useResource('/marcaciones?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeAttendance });
  const novedades = useResource('/reportes/novedades?limit=10', { items: [], total: 0 }, [role], { enabled: isAdminEmpresa || isRrhh });
  const mensual = useResource(`/reportes/asistencia-mensual?mes=${new Date().toISOString().slice(0, 7)}`, { resumen: {}, items: [] }, [role], {
    enabled: isAdminEmpresa || isRrhh,
  });

  const invoiceTotal = getRows(facturas.data).reduce((total, item) => total + Number(item.total || 0), 0);
  const pagosTotal = getRows(pagos.data).reduce((total, item) => total + Number(item.monto || 0), 0);
  const monthlyAttendance = buildMonthlyAttendance(mensual.data.items || []);
  const branchActivity = buildBranchActivity(getRows(marcaciones.data));
  const subscriptionsByPlan = buildSubscriptionsByPlan(getRows(suscripciones.data));
  const paymentsByMethod = buildPaymentsByMethod(getRows(pagos.data));

  return (
    <>
      <PageHeader
        title={`Dashboard ${getRoleLabel(role)}`}
        description={user?.empresa ? `${user.empresa} · ${user.email}` : user?.email || 'Panel operativo'}
        actions={<span className="status-pill">{role}</span>}
      />

      {isSuperAdmin && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Empresas" value={getTotal(empresas.data)} icon={Building2} />
            <MetricCard label="Planes activos" value={Array.isArray(planes.data) ? planes.data.filter((plan) => plan.activo).length : 0} icon={CreditCard} tone="success" />
            <MetricCard label="Suscripciones" value={getTotal(suscripciones.data)} icon={UserCheck} tone="accent" />
            <MetricCard label="Pagos" value={money(pagosTotal || invoiceTotal)} icon={BarChart3} tone="warning" />
          </section>
          <section className="charts-grid">
            <div className="panel">
              <PanelTitle title="Suscripciones por Plan" subtitle="Distribución actual de planes" />
              <Suspense fallback={<ChartFallback height={240} />}>
                <DashboardChart type="pie" data={subscriptionsByPlan} />
              </Suspense>
            </div>
            <div className="panel">
              <PanelTitle title="Ingresos por Método" subtitle="Total recaudado por medio de pago" />
              <Suspense fallback={<ChartFallback height={240} />}>
                <DashboardChart type="bar" data={paymentsByMethod} />
              </Suspense>
            </div>
          </section>
          <section className="dashboard-grid">
            <DataPanel title="Empresas recientes" rows={getRows(empresas.data)} columns={['nombre', 'estado', 'email']} />
            <DataPanel title="Suscripciones" rows={getRows(suscripciones.data)} columns={['empresa_nombre', 'plan_nombre', 'estado', 'fecha_fin']} />
            <DataPanel title="Pagos recientes" rows={getRows(pagos.data)} columns={['factura_numero', 'monto', 'metodo', 'estado']} />
          </section>
        </>
      )}

      {isAdminEmpresa && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Sucursales" value={getTotal(sucursales.data)} icon={MapPin} />
            <MetricCard label="Empleados" value={getTotal(empleados.data)} icon={Users} tone="success" />
            <MetricCard label="Horarios" value={getTotal(horarios.data)} icon={CalendarClock} tone="accent" />
            <MetricCard label="Novedades mes" value={mensual.data.resumen?.novedades || 0} icon={FileBarChart} tone="warning" />
          </section>
          <section className="dashboard-grid">
            <div className="panel wide">
              <PanelTitle title="Asistencia mensual" subtitle="Resumen operativo por empresa" />
              <Suspense fallback={<ChartFallback height={280} />}>
                <DashboardChart type="monthly" data={monthlyAttendance} />
              </Suspense>
            </div>
            <DataPanel title="Sucursales" rows={getRows(sucursales.data)} columns={['nombre', 'codigo', 'ciudad', 'estado']} />
            <DataPanel title="Empleados recientes" rows={getRows(empleados.data)} columns={['codigo', 'nombres', 'apellidos', 'cargo']} />
            <DataPanel title="Novedades recientes" rows={getRows(novedades.data)} columns={['empleado_codigo', 'motivo_novedad', 'sucursal_nombre']} />
          </section>
        </>
      )}

      {isRrhh && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Marcaciones" value={getTotal(marcaciones.data)} icon={Activity} />
            <MetricCard label="Novedades" value={getTotal(novedades.data)} icon={FileBarChart} tone="warning" />
            <MetricCard label="Marcaciones mes" value={mensual.data.resumen?.total_marcaciones || 0} icon={UserCheck} tone="success" />
            <MetricCard label="Rechazadas mes" value={mensual.data.resumen?.rechazadas || 0} icon={Users} tone="accent" />
          </section>
          <section className="dashboard-grid">
            <div className="panel wide">
              <PanelTitle title="Asistencia mensual" subtitle="Resumen operativo de marcaciones y novedades" />
              <Suspense fallback={<ChartFallback height={280} />}>
                <DashboardChart type="monthly" data={monthlyAttendance} />
              </Suspense>
            </div>
            <DataPanel title="Marcaciones recientes" rows={getRows(marcaciones.data)} columns={['empleado_codigo', 'sucursal_nombre', 'tipo', 'estado', 'marcado_en']} />
            <DataPanel title="Novedades recientes" rows={getRows(novedades.data)} columns={['empleado_codigo', 'motivo_novedad', 'sucursal_nombre']} />
          </section>
        </>
      )}

      {isEmpleado && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Mis marcaciones" value={getTotal(marcaciones.data)} icon={Activity} />
            <MetricCard label="Estado" value="Activo" icon={UserCheck} tone="success" />
            <MetricCard label="Empresa" value={user?.empresa || '-'} icon={Building2} tone="accent" />
            <MetricCard label="Rol" value={getRoleLabel(role)} icon={Users} tone="warning" />
          </section>
          <section className="dashboard-grid">
            <div className="panel">
              <PanelTitle title="Actividad por sucursal" subtitle="Historial visual" />
              <Suspense fallback={<ChartFallback height={240} />}>
                <DashboardChart type="branch" data={branchActivity} />
              </Suspense>
            </div>
            <DataPanel title="Historial personal" rows={getRows(marcaciones.data)} columns={['sucursal_nombre', 'tipo', 'estado', 'marcado_en']} />
          </section>
        </>
      )}
    </>
  );
}
