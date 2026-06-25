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
  ClipboardCheck,
  Calculator,
  ScrollText,
  UserCog,
  BriefcaseBusiness,
  DatabaseZap,
  Star,
} from 'lucide-react';
import { ROLES } from '../utils/roles';

export const navSections = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    hideHeader: true,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'platform',
    label: 'Plataforma',
    icon: ShieldCheck,
    roles: [ROLES.SUPER_ADMIN],
    items: [
      { title: 'Empresas', href: '/empresas', icon: Building2 },
      { title: 'Planes', href: '/planes', icon: CreditCard },
      { title: 'Suscripciones', href: '/suscripciones', icon: ShieldCheck },
      { title: 'Facturacion', href: '/facturacion', icon: CreditCard },
      { title: 'SaaS y cobranza', href: '/saas-control', icon: DatabaseZap, permission: ['saas_consumo', 'ver'] },
      { title: 'Auditoría', href: '/auditoria', icon: ScrollText },
    ],
  },
  {
    id: 'organization',
    label: 'Organizacion',
    icon: Building2,
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [
      { title: 'Sucursales', href: '/sucursales', icon: MapPin, feature: 'sucursales' },
      { title: 'Empleados', href: '/empleados', icon: Users, feature: 'empleados' },
      { title: 'Estructura', href: '/organizacion', icon: BriefcaseBusiness, feature: 'organizacion', permission: ['organizacion', 'ver'] },
      { title: 'Horarios', href: '/horarios', icon: CalendarClock, feature: 'horarios' },
      { title: 'Feriados', href: '/feriados', icon: Star, feature: 'horarios' },
      { title: 'Reemplazos', href: '/reemplazos', icon: Repeat2, feature: 'reemplazos' },
    ],
  },
  {
    id: 'operations',
    label: 'Operacion',
    icon: ClipboardCheck,
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [
      { title: 'Historial general', href: '/historial-general', icon: Activity, permission: ['reportes', 'ver'] },
      { title: 'Solicitudes', href: '/solicitudes', icon: ClipboardCheck, permission: ['solicitudes', 'ver'] },
      { title: 'Calculo laboral', href: '/calculo-laboral', icon: Calculator, permission: ['calculo_laboral', 'ver'] },
      { title: 'Reportes', href: '/reportes', icon: FileBarChart, feature: 'reportes_avanzados', permission: ['reportes', 'ver'] },
    ],
  },
  {
    id: 'billing',
    label: 'Suscripcion',
    icon: CreditCard,
    roles: [ROLES.ADMIN_EMPRESA],
    items: [{ title: 'Facturacion', href: '/facturacion', icon: CreditCard, feature: 'facturacion' }],
  },
  {
    id: 'attendance',
    label: 'Asistencia',
    icon: CalendarClock,
    roles: [ROLES.EMPLEADO],
    items: [
      { title: 'Marcar', href: '/marcaciones', icon: ScanLine, feature: 'marcaciones' },
      { title: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity, feature: 'mis_marcaciones' },
      { title: 'Solicitudes', href: '/solicitudes', icon: ClipboardCheck, permission: ['solicitudes', 'ver'] },
    ],
  },
  {
    id: 'self-attendance',
    label: 'Mi asistencia',
    icon: CalendarClock,
    roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH],
    items: [
      { title: 'Marcar', href: '/marcaciones', icon: ScanLine, feature: 'marcaciones' },
      { title: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity, feature: 'mis_marcaciones' },
    ],
  },
  {
    id: 'account',
    label: 'Cuenta',
    icon: UserCog,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO],
    items: [
      { title: 'Roles y permisos', href: '/roles-permisos', icon: UserCog, roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA] },
      { title: 'Ajustes', href: '/settings', icon: Settings },
    ],
  },
];

export function getNavSectionsForRole(role, userModulos = {}, userPermissions = {}) {
  return navSections
    .filter((section) => section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles && !item.roles.includes(role)) return false;
        if (item.permission && role !== ROLES.SUPER_ADMIN) {
          const [resource, action] = item.permission;
          if (userPermissions?.[resource]?.[action] !== true) return false;
        }
        if (!item.feature) return true;
        if (role === ROLES.SUPER_ADMIN) return true;
        return userModulos[item.feature] === true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}
