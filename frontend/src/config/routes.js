import { lazy } from 'react';
import { routeRoles } from '../utils/roles';

const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const EmpleadosList = lazy(() => import('../pages/empleados/EmpleadosList'));
const EmpresasList = lazy(() => import('../pages/empresas/EmpresasList'));
const Facturas = lazy(() => import('../pages/facturacion/Facturas'));
const HorariosList = lazy(() => import('../pages/horarios/HorariosList'));
const FeriadosList = lazy(() => import('../pages/horarios/FeriadosList'));
const HistorialMarcaciones = lazy(() => import('../pages/marcaciones/HistorialMarcaciones'));
const MarcarAsistencia = lazy(() => import('../pages/marcaciones/MarcarAsistencia'));
const PlanesList = lazy(() => import('../pages/planes/PlanesList'));
const Reportes = lazy(() => import('../pages/reportes/Reportes'));
const ReemplazosList = lazy(() => import('../pages/reemplazos/ReemplazosList'));
const Settings = lazy(() => import('../pages/settings/Settings'));
const SuscripcionesList = lazy(() => import('../pages/suscripciones/SuscripcionesList'));
const SucursalesList = lazy(() => import('../pages/sucursales/SucursalesList'));
const SolicitudesList = lazy(() => import('../pages/solicitudes/SolicitudesList'));
const CalculoLaboral = lazy(() => import('../pages/laboral/CalculoLaboral'));
const Auditoria = lazy(() => import('../pages/auditoria/Auditoria'));
const RolesPermisos = lazy(() => import('../pages/settings/RolesPermisos'));
const EstructuraOrganizacional = lazy(() => import('../pages/organizacion/EstructuraOrganizacional'));
const SaasControl = lazy(() => import('../pages/saas/SaasControl'));
const AppMovil = lazy(() => import('../pages/app/AppMovil'));
const VacacionesSaldo = lazy(() => import('../pages/vacaciones/VacacionesSaldo'));

export const privateRoutes = [
  {
    path: '/dashboard',
    element: Dashboard,
    roles: routeRoles.all,
  },
  {
    path: '/empresas',
    element: EmpresasList,
    roles: routeRoles.superAdmin,
  },
  {
    path: '/planes',
    element: PlanesList,
    roles: routeRoles.superAdmin,
  },
  {
    path: '/suscripciones',
    element: SuscripcionesList,
    roles: routeRoles.superAdmin,
  },
  {
    path: '/sucursales',
    element: SucursalesList,
    roles: routeRoles.rrhh,
    feature: 'sucursales',
  },
  {
    path: '/empleados',
    element: EmpleadosList,
    roles: routeRoles.rrhh,
    feature: 'empleados',
  },
  {
    path: '/horarios',
    element: HorariosList,
    roles: routeRoles.rrhh,
    feature: 'horarios',
  },
  {
    path: '/feriados',
    element: FeriadosList,
    roles: routeRoles.rrhh,
    feature: 'horarios',
  },
  {
    path: '/reemplazos',
    element: ReemplazosList,
    roles: routeRoles.rrhh,
    feature: 'reemplazos',
  },
  {
    path: '/marcaciones',
    element: MarcarAsistencia,
    roles: routeRoles.personal,
    feature: 'marcaciones',
  },
  {
    path: '/mis-marcaciones',
    element: HistorialMarcaciones,
    roles: routeRoles.personal,
    feature: 'mis_marcaciones',
  },
  {
    path: '/historial-general',
    element: HistorialMarcaciones,
    roles: routeRoles.rrhh,
    permission: ['reportes', 'ver'],
  },
  {
    path: '/reportes',
    element: Reportes,
    roles: routeRoles.rrhh,
    feature: 'reportes_avanzados',
  },
  {
    path: '/facturacion',
    element: Facturas,
    roles: routeRoles.adminEmpresa,
    feature: 'facturacion',
  },
  {
    path: '/organizacion',
    element: EstructuraOrganizacional,
    roles: routeRoles.rrhh,
    feature: 'organizacion',
    permission: ['organizacion', 'ver'],
  },
  {
    path: '/saas-control',
    element: SaasControl,
    roles: routeRoles.superAdmin,
    permission: ['saas_consumo', 'ver'],
  },
  {
    path: '/app-movil',
    element: AppMovil,
    roles: routeRoles.all,
  },
  {
    path: '/solicitudes', element: SolicitudesList, roles: routeRoles.all, permission: ['solicitudes', 'ver'],
  },
  {
    path: '/calculo-laboral', element: CalculoLaboral, roles: routeRoles.rrhh, permission: ['calculo_laboral', 'ver'],
  },
  {
    path: '/vacaciones', element: VacacionesSaldo, roles: routeRoles.rrhh, permission: ['vacaciones', 'ver'],
  },
  {
    path: '/auditoria', element: Auditoria, roles: routeRoles.superAdmin,
  },
  {
    path: '/roles-permisos', element: RolesPermisos, roles: routeRoles.adminEmpresa,
  },
  {
    path: '/settings',
    element: Settings,
    roles: routeRoles.all,
  },
];
