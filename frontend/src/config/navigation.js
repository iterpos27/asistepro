import {
  Activity,
  Building2,
  CalendarClock,
  Repeat2,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  MapPin,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ROLES } from '../utils/roles';

export const navSections = [
  {
    id: 'platform',
    label: 'Plataforma',
    roles: [ROLES.SUPER_ADMIN],
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Empresas', href: '/empresas', icon: Building2 },
      { title: 'Planes', href: '/planes', icon: CreditCard },
      { title: 'Suscripciones', href: '/suscripciones', icon: ShieldCheck },
      { title: 'Facturacion', href: '/facturacion', icon: CreditCard },
    ],
  },
  {
    id: 'summary',
    label: 'Resumen',
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'organization',
    label: 'Organizacion',
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [
      { title: 'Sucursales', href: '/sucursales', icon: MapPin, feature: 'sucursales' },
      { title: 'Empleados', href: '/empleados', icon: Users, feature: 'empleados' },
      { title: 'Horarios', href: '/horarios', icon: CalendarClock, feature: 'horarios' },
      { title: 'Reemplazos', href: '/reemplazos', icon: Repeat2, feature: 'reemplazos' },
    ],
  },
  {
    id: 'operations',
    label: 'Operacion',
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [{ title: 'Reportes', href: '/reportes', icon: FileBarChart, feature: 'reportes_avanzados' }],
  },
  {
    id: 'billing',
    label: 'Suscripcion',
    roles: [ROLES.ADMIN_EMPRESA],
    items: [{ title: 'Facturacion', href: '/facturacion', icon: CreditCard, feature: 'facturacion' }],
  },
  {
    id: 'attendance',
    label: 'Asistencia',
    roles: [ROLES.EMPLEADO],
    items: [
      { title: 'Marcar', href: '/marcaciones', icon: ScanLine, feature: 'marcaciones' },
      { title: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity, feature: 'mis_marcaciones' },
    ],
  },
  {
    id: 'self-attendance',
    label: 'Mi asistencia',
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [
      { title: 'Marcar', href: '/marcaciones', icon: ScanLine, feature: 'marcaciones' },
      { title: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity, feature: 'mis_marcaciones' },
    ],
  },
  {
    id: 'account',
    label: 'Cuenta',
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO],
    items: [{ title: 'Ajustes', href: '/settings', icon: Settings }],
  },
];

export function getNavSectionsForRole(role, userModulos = {}) {
  return navSections
    .filter((section) => section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.feature) return true;
        if (role === ROLES.SUPER_ADMIN) return true;
        return userModulos[item.feature] === true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}
