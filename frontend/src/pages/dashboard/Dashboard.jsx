import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  MapPin,
  Receipt,
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

function completionSummary(items) {
  return items.map((item) => ({
    title: item.title,
    value: item.done ? 'Listo' : 'Pendiente',
    tone: item.done ? 'ok' : 'warning',
    href: item.href,
    note: item.note,
  }));
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
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const empresas = useResource('/empresas?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const planes = useResource('/planes', [], [role], { enabled: isSuperAdmin });
  const suscripciones = useResource('/suscripciones?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const facturas = useResource('/facturacion/facturas?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });
  const pagos = useResource('/facturacion/pagos?limit=100', { items: [], total: 0 }, [role], { enabled: isSuperAdmin });

  const sucursales = useResource('/sucursales?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeTenantOps });
  const empleados = useResource('/empleados?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeTenantOps });
  const horarios = useResource('/horarios?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeTenantOps });
  const marcaciones = useResource('/marcaciones?limit=100', { items: [], total: 0 }, [role], { enabled: canSeeAttendance });
  const novedades = useResource('/reportes/novedades?limit=8', { items: [], total: 0 }, [role], { enabled: canSeeTenantOps });
  const mensual = useResource(`/reportes/asistencia-mensual?mes=${month}`, { resumen: {}, items: [] }, [role], {
    enabled: canSeeTenantOps,
  });
  const resumenEjecutivo = useResource(
    `/reportes/resumen-ejecutivo?fecha_desde=${today}&fecha_hasta=${today}`,
    { resumen: {} },
    [role, today],
    { enabled: canSeeTenantOps },
  );
  const solicitudesPendientes = useResource('/solicitudes?estado=pendiente&limit=8', { items: [], total: 0 }, [role], {
    enabled: canSeeTenantOps,
  });
  const facturasVencidas = useResource('/facturacion/facturas?estado=vencida&limit=8', { items: [], total: 0 }, [role], {
    enabled: isAdminEmpresa,
  });

  const invoiceTotal = getRows(facturas.data).reduce((total, item) => total + Number(item.total || 0), 0);
  const pagosTotal = getRows(pagos.data).reduce((total, item) => total + Number(item.monto || 0), 0);
  const monthlyAttendance = buildMonthlyAttendance(mensual.data.items || []);
  const branchActivity = buildBranchActivity(getRows(marcaciones.data));
  const subscriptionsByPlan = buildSubscriptionsByPlan(getRows(suscripciones.data));
  const paymentsByMethod = buildPaymentsByMethod(getRows(pagos.data));

  const resumen = resumenEjecutivo.data?.resumen || {};
  const onboardingItems = useMemo(
    () =>
      completionSummary([
        {
          title: 'Empresa operativa',
          done: Boolean(user?.empresa),
          href: '/settings',
          note: 'Mantener datos basicos y perfil del tenant al dia.',
        },
        {
          title: 'Sucursales registradas',
          done: getTotal(sucursales.data) > 0,
          href: '/sucursales',
          note: 'Cada sede debe quedar lista con geocerca y QR.',
        },
        {
          title: 'Empleados activos',
          done: getTotal(empleados.data) > 0,
          href: '/empleados',
          note: 'Sin personal activo no hay marcaciones ni reportes utiles.',
        },
        {
          title: 'Horarios asignables',
          done: getTotal(horarios.data) > 0,
          href: '/horarios',
          note: 'Define la jornada para medir atrasos y horas trabajadas.',
        },
      ]),
    [user?.empresa, sucursales.data, empleados.data, horarios.data],
  );

  const tenantAlerts = useMemo(() => {
    if (!canSeeTenantOps) return [];

    const alerts = [];
    if (Number(resumen.jornadas_incompletas || 0) > 0) {
      alerts.push({
        title: 'Jornadas incompletas hoy',
        value: `${resumen.jornadas_incompletas}`,
        description: 'Existen entradas sin salida registrada o jornadas inconsistentes.',
        href: '/reportes',
      });
    }
    if (Number(resumen.solicitudes_pendientes || 0) > 0) {
      alerts.push({
        title: 'Solicitudes por revisar',
        value: `${resumen.solicitudes_pendientes}`,
        description: 'Hay vacaciones, permisos o correcciones esperando aprobacion.',
        href: '/solicitudes',
      });
    }
    if (Number(resumen.atrasos || 0) > 0) {
      alerts.push({
        title: 'Atrasos detectados',
        value: `${resumen.atrasos}`,
        description: 'Revisa puntualidad y confirma si hay justificaciones pendientes.',
        href: '/reportes',
      });
    }
    if (isAdminEmpresa && Number(resumen.facturas_vencidas || 0) > 0) {
      alerts.push({
        title: 'Facturas vencidas',
        value: `${resumen.facturas_vencidas}`,
        description: `Saldo pendiente actual ${money(resumen.saldo_pendiente)}.`,
        href: '/facturacion',
      });
    }
    return alerts;
  }, [canSeeTenantOps, isAdminEmpresa, resumen]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={isSuperAdmin ? 'Resumen general de la plataforma' : user?.empresa || 'Centro operativo de asistencia'}
      />

      {isSuperAdmin && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Empresas" value={getTotal(empresas.data)} icon={Building2} />
            <MetricCard
              label="Planes activos"
              value={Array.isArray(planes.data) ? planes.data.filter((plan) => plan.activo).length : 0}
              icon={CreditCard}
              tone="success"
            />
            <MetricCard label="Suscripciones" value={getTotal(suscripciones.data)} icon={UserCheck} tone="accent" />
            <MetricCard label="Cobrado" value={money(pagosTotal || invoiceTotal)} icon={BarChart3} tone="warning" />
          </section>
          <section className="charts-grid">
            <div className="panel">
              <PanelTitle title="Suscripciones por plan" subtitle="Distribucion comercial actual" />
              <Suspense fallback={<ChartFallback height={240} />}>
                <DashboardChart type="pie" data={subscriptionsByPlan} />
              </Suspense>
            </div>
            <div className="panel">
              <PanelTitle title="Pagos por metodo" subtitle="Cobranza consolidada" />
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

      {canSeeTenantOps && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Sucursales activas" value={resumen.total_sucursales || getTotal(sucursales.data)} icon={MapPin} />
            <MetricCard label="Empleados activos" value={resumen.total_empleados || getTotal(empleados.data)} icon={Users} tone="success" />
            <MetricCard
              label="Cumplimiento jornada"
              value={`${Number(resumen.cumplimiento_jornada_porcentaje || 0).toFixed(0)}%`}
              icon={CheckCircle2}
              tone="accent"
            />
            <MetricCard
              label="Horas del dia"
              value={`${Number(resumen.horas_trabajadas || 0).toFixed(2)}h`}
              icon={CalendarClock}
              tone="warning"
            />
          </section>

          <section className="dashboard-split">
            <div className="panel">
              <PanelTitle title="Alertas operativas" subtitle="Lo que necesita atencion inmediata hoy" />
              <div className="stack-list">
                {tenantAlerts.length ? (
                  tenantAlerts.map((alert) => (
                    <Link key={alert.title} to={alert.href} className="list-row clickable-row">
                      <div>
                        <strong>{alert.title}</strong>
                        <span className="table-subtext">{alert.description}</span>
                      </div>
                      <span className="status-pill warning">{alert.value}</span>
                    </Link>
                  ))
                ) : (
                  <div className="list-row">
                    <div>
                      <strong>Operacion bajo control</strong>
                      <span className="table-subtext">No se detectaron alertas urgentes en la jornada actual.</span>
                    </div>
                    <span className="status-pill">OK</span>
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <PanelTitle title="Checklist de arranque" subtitle="Lo minimo para que la operacion marque bien y reporte bien" />
              <div className="stack-list">
                {onboardingItems.map((item) => (
                  <Link key={item.title} to={item.href} className="list-row clickable-row">
                    <div>
                      <strong>{item.title}</strong>
                      <span className="table-subtext">{item.note}</span>
                    </div>
                    <span className={item.tone === 'ok' ? 'status-pill' : 'status-pill warning'}>{item.value}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="dashboard-grid">
            <div className="panel wide">
              <PanelTitle title="Asistencia mensual" subtitle="Tendencia de presentes, novedades y rechazos" />
              <Suspense fallback={<ChartFallback height={280} />}>
                <DashboardChart type="monthly" data={monthlyAttendance} />
              </Suspense>
            </div>
            <DataPanel
              title="Solicitudes pendientes"
              rows={getRows(solicitudesPendientes.data)}
              columns={['empleado_codigo', 'tipo', 'fecha_inicio', 'estado']}
            />
            <DataPanel
              title="Novedades recientes"
              rows={getRows(novedades.data)}
              columns={['empleado_codigo', 'motivo_novedad', 'sucursal_nombre']}
            />
            {isAdminEmpresa ? (
              <DataPanel
                title="Cobranza por atender"
                rows={getRows(facturasVencidas.data)}
                columns={['numero', 'concepto', 'estado', 'fecha_vencimiento']}
              />
            ) : (
              <DataPanel
                title="Empleados recientes"
                rows={getRows(empleados.data)}
                columns={['codigo', 'nombres', 'apellidos', 'cargo']}
              />
            )}
          </section>
        </>
      )}

      {isEmpleado && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Mis marcaciones" value={getTotal(marcaciones.data)} icon={Activity} />
            <MetricCard label="Estado" value="Activo" icon={UserCheck} tone="success" />
            <MetricCard label="Empresa" value={user?.empresa || '-'} icon={Building2} tone="accent" />
            <MetricCard label="Perfil" value={getRoleLabel(role)} icon={Users} tone="warning" />
          </section>
          <section className="dashboard-split">
            <div className="panel">
              <PanelTitle title="Tu jornada" subtitle="Usa el navegador o la PWA para marcar rapido desde celular" />
              <div className="stack-list">
                <Link to="/marcaciones" className="list-row clickable-row">
                  <div>
                    <strong>Registrar asistencia</strong>
                    <span className="table-subtext">QR, GPS y confirmacion de entrada o salida.</span>
                  </div>
                  <span className="status-pill">Abrir</span>
                </Link>
                <Link to="/solicitudes" className="list-row clickable-row">
                  <div>
                    <strong>Solicitar correccion o permiso</strong>
                    <span className="table-subtext">Gestiona ausencias, permisos y ajustes de marcacion.</span>
                  </div>
                  <span className="status-pill muted">Gestion</span>
                </Link>
              </div>
            </div>
            <div className="panel">
              <PanelTitle title="Actividad por sucursal" subtitle="Historial visual de tus registros" />
              <Suspense fallback={<ChartFallback height={240} />}>
                <DashboardChart type="branch" data={branchActivity} />
              </Suspense>
            </div>
          </section>
          <DataPanel title="Historial personal" rows={getRows(marcaciones.data)} columns={['sucursal_nombre', 'tipo', 'estado', 'marcado_en']} />
        </>
      )}

      {!isSuperAdmin && !canSeeTenantOps && !isEmpleado ? (
        <div className="panel">
          <PanelTitle title="Sin datos suficientes" subtitle="Tu perfil aun no tiene panel operativo asignado." />
          <div className="alert-error">Revisa la configuracion de permisos o el tenant activo para continuar.</div>
        </div>
      ) : null}
    </>
  );
}
