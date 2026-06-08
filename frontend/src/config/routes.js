import Dashboard from '../pages/dashboard/Dashboard';
import EmpleadosList from '../pages/empleados/EmpleadosList';
import EmpresasList from '../pages/empresas/EmpresasList';
import Facturas from '../pages/facturacion/Facturas';
import FacturacionPagos from '../pages/facturacion/FacturacionPagos';
import HorariosList from '../pages/horarios/HorariosList';
import HistorialMarcaciones from '../pages/marcaciones/HistorialMarcaciones';
import MarcarAsistencia from '../pages/marcaciones/MarcarAsistencia';
import PlanesList from '../pages/planes/PlanesList';
import Reportes from '../pages/reportes/Reportes';
import Settings from '../pages/settings/Settings';
import SuscripcionesList from '../pages/suscripciones/SuscripcionesList';
import SucursalesList from '../pages/sucursales/SucursalesList';
import { routeRoles } from '../utils/roles';

export const privateRoutes = [
  {
    path: '/dashboard',
    element: Dashboard,
    roles: routeRoles.empleado,
  },
  {
    path: '/admin',
    element: Dashboard,
    roles: routeRoles.empleado,
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
    roles: routeRoles.empleado,
  },
  {
    path: '/mis-marcaciones',
    element: HistorialMarcaciones,
    roles: routeRoles.empleado,
  },
  {
    path: '/reportes',
    element: Reportes,
    roles: routeRoles.rrhh,
  },
  {
    path: '/facturacion',
    element: Facturas,
    roles: routeRoles.adminEmpresa,
  },
  {
    path: '/facturacion/pagos',
    element: FacturacionPagos,
    roles: routeRoles.adminEmpresa,
  },
  {
    path: '/settings',
    element: Settings,
    roles: routeRoles.empleado,
  },
];
