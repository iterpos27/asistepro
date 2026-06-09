import {
  Activity,
  Building2,
  CalendarClock,
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
      { title: 'Sucursales', href: '/sucursales', icon: MapPin },
      { title: 'Empleados', href: '/empleados', icon: Users },
      { title: 'Horarios', href: '/horarios', icon: CalendarClock },
    ],
  },
  {
    id: 'operations',
    label: 'Operacion',
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [{ title: 'Reportes', href: '/reportes', icon: FileBarChart }],
  },
  {
    id: 'billing',
    label: 'Suscripcion',
    roles: [ROLES.ADMIN_EMPRESA],
    items: [{ title: 'Facturacion', href: '/facturacion', icon: CreditCard }],
  },
  {
    id: 'attendance',
    label: 'Asistencia',
    roles: [ROLES.EMPLEADO],
    items: [
      { title: 'Marcar', href: '/marcaciones', icon: ScanLine },
      { title: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity },
    ],
  },
  {
    id: 'self-attendance',
    label: 'Mi asistencia',
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [
      { title: 'Marcar', href: '/marcaciones', icon: ScanLine },
      { title: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity },
    ],
  },
  {
    id: 'account',
    label: 'Cuenta',
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO],
    items: [{ title: 'Ajustes', href: '/settings', icon: Settings }],
  },
];

export function getNavSectionsForRole(role) {
  return navSections
    .filter((section) => section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items,
    }));
}
