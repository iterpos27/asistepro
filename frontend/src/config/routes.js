import { lazy } from 'react';
import { routeRoles } from '../utils/roles';

const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const EmpleadosList = lazy(() => import('../pages/empleados/EmpleadosList'));
const EmpresasList = lazy(() => import('../pages/empresas/EmpresasList'));
const Facturas = lazy(() => import('../pages/facturacion/Facturas'));
const HorariosList = lazy(() => import('../pages/horarios/HorariosList'));
const HistorialMarcaciones = lazy(() => import('../pages/marcaciones/HistorialMarcaciones'));
const MarcarAsistencia = lazy(() => import('../pages/marcaciones/MarcarAsistencia'));
const PlanesList = lazy(() => import('../pages/planes/PlanesList'));
const Reportes = lazy(() => import('../pages/reportes/Reportes'));
const Settings = lazy(() => import('../pages/settings/Settings'));
const SuscripcionesList = lazy(() => import('../pages/suscripciones/SuscripcionesList'));
const SucursalesList = lazy(() => import('../pages/sucursales/SucursalesList'));

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
  },
  {
    path: '/empleados',
    element: EmpleadosList,
    roles: routeRoles.rrhh,
  },
  {
    path: '/horarios',
    element: HorariosList,
    roles: routeRoles.rrhh,
  },
  {
    path: '/marcaciones',
    element: MarcarAsistencia,
    roles: routeRoles.personal,
  },
  {
    path: '/mis-marcaciones',
    element: HistorialMarcaciones,
    roles: routeRoles.personal,
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
  },
  {
    path: '/settings',
    element: Settings,
    roles: routeRoles.all,
  },
];
