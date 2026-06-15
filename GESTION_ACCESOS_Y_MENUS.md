# Plan de Diseño de Menús y Gestión de Permisos (Feature Gating) - ASISTEPRO

Este documento presenta una propuesta profesional de Experiencia de Usuario (UX) para los menús de navegación según el rol, y detalla la estrategia técnica para permitir que el **SUPER_ADMIN** restrinja o habilite módulos a nivel de empresa (Tenant) o plan de suscripción.

---

## 1. Diseño de Menús por Rol (UX/UI Best Practices)

En un entorno SaaS, el menú debe responder al flujo de trabajo del usuario diario. Menos es más: los menús deben ser limpios y enfocados en las tareas operativas de cada perfil.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ MENÚS DE ASISTEPRO (Propuesta UX)                                       │
├───────────────┬───────────────────┬───────────────────┬─────────────────┤
│ SUPER_ADMIN   │ ADMIN_EMPRESA     │ RECURSOS HUMANOS  │ EMPLEADO        │
├───────────────┼───────────────────┼───────────────────┼─────────────────┤
│ • Dashboard   │ • Dashboard       │ • Monitoreo En    │ • Marcar        │
│   SaaS        │   Empresa         │   Vivo            │   Asistencia    │
│ • Empresas    │ • Sucursales      │ • Empleados       │ • Mi Historial  │
│ • Planes      │ • Horarios        │ • Marcaciones     │ • Justificar    │
│ • Cobros      │ • Empleados       │ • Novedades       │ • Ajustes       │
│ • Logs        │ • Suscripción     │ • Reportes        │                 │
│               │ • Reportes        │                   │                 │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
```

### A. SUPER_ADMIN (Controlador del SaaS)
*   **Enfoque:** Monitoreo del negocio, finanzas, métricas de retención de clientes y licenciamiento.
*   **Estructura sugerida:**
    1.  **Dashboard Global:** Facturación mensual (MRR), número de empresas activas y uso general de recursos.
    2.  **Empresas (Tenants):** Registro, suspensión de cuentas y configuración especial.
    3.  **Planes y Suscripciones:** Creación y modificación de los planes comerciales y sus precios.
    4.  **Aprobación de Cobros:** Control de pagos manuales realizados por transferencia.
    5.  **Logs y Auditoría:** Trazabilidad de operaciones críticas en el sistema.

### B. ADMIN_EMPRESA (Dueño de la Suscripción / Cliente)
*   **Enfoque:** Configuración organizativa inicial, control de costos del plan, altas/bajas de personal y consulta de reportes consolidados.
*   **Estructura sugerida:**
    1.  **Dashboard Operativo:** Resumen gráfico del ausentismo diario y estado de alertas.
    2.  **Sucursales:** Creación de geocercas, radios en metros y descarga de tokens QR.
    3.  **Horarios:** Plantillas de turnos (tolerancias, horas de entrada/salida).
    4.  **Empleados:** Creación y asignación de usuarios operadores (ej. RRHH).
    5.  **Mi Suscripción y Facturación:** Estado actual del plan, facturas pendientes y carga de recibos de pago.
    6.  **Reportes Consolidados:** Descarga de hojas de asistencia mensuales.

### C. RRHH (Recursos Humanos / Operador de Personal)
*   **Enfoque:** Operación diaria del personal, aprobación de novedades y justificación de tardanzas.
*   **Estructura sugerida:**
    1.  **Monitoreo en Vivo:** Muestra las marcaciones realizadas hoy minuto a minuto en un mapa/tabla.
    2.  **Gestión de Empleados:** Asignación de horarios individuales y sucursales habituales.
    3.  **Historial de Marcaciones:** Registro histórico detallado.
    4.  **Novedades y Justificaciones:** Gestión de justificaciones cargadas por empleados (por enfermedad, comisión externa, etc.).
    5.  **Generación de Reportes:** Exportación de archivos para la liquidación de nómina.

### D. EMPLEADO (Usuario de Autoconsulta y Registro)
*   **Enfoque:** Interfaz optimizada para móviles, rápida e interactiva. Sin menús administrativos.
*   **Estructura sugerida:**
    1.  **Marcar Asistencia (Home):** Acceso rápido para captura de GPS y escaneo de QR.
    2.  **Mi Historial:** Reporte visual simple de sus horas de entrada, salida y minutos de atraso acumulados.
    3.  **Justificaciones:** Solicitudes de justificación para novedades detectadas.
    4.  **Mi Perfil / Ajustes:** Cambio de contraseña y datos personales básicos.

---

## 2. Cómo Restringir Módulos (Feature Gating)

Para permitir que el **SUPER_ADMIN** controle el acceso a ciertos módulos en los demás usuarios, el sistema no debe basarse solo en el rol, sino también en las **Habilitaciones del Plan** (Plan Limits) y los **Feature Flags** (Banderas de características).

Esto se implementa a tres niveles: **Base de Datos, Backend (API) y Frontend (UI).**

### Nivel 1: Base de Datos
Debemos ampliar la tabla `planes` o crear una tabla de configuración por empresa para habilitar o deshabilitar módulos específicos.

```sql
-- Agregar columnas de módulos en la tabla de planes
ALTER TABLE planes
ADD COLUMN IF NOT EXISTS modulo_reportes_avanzados BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS modulo_justificaciones BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS modulo_qr_dinamico BOOLEAN NOT NULL DEFAULT FALSE;

-- O, de forma más flexible, usar una columna JSONB en la tabla 'empresas' para habilitar módulos especiales
ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS configuracion_modulos JSONB DEFAULT '{}'::jsonb;
```

*Ejemplo de JSONB en `configuracion_modulos`:*
```json
{
  "reportes_avanzados": true,
  "qr_dinamico": false,
  "justificaciones": true
}
```

---

### Nivel 2: Backend (Control de Acceso mediante Middlewares)

En el backend, el middleware `planGuard` debe extenderse para verificar si el plan activo o la empresa en particular tiene el módulo habilitado antes de procesar el endpoint.

```javascript
// backend/src/middlewares/tenant.middleware.js

// Middleware genérico para verificar si una funcionalidad está activa
function featureGuard(featureName) {
  return (req, res, next) => {
    // 1. Si es SUPER_ADMIN, tiene acceso libre a todos los módulos
    if (req.auth?.rol === 'SUPER_ADMIN') {
      return next();
    }

    // 2. Extraer la configuración de módulos de la empresa
    const configuracionModulos = req.tenant?.empresa?.configuracion_modulos || {};
    
    // 3. Extraer configuración heredada del plan de la empresa
    const planFeatures = req.tenant?.subscription?.plan_features || {};

    // 4. Verificar si el feature está habilitado en la empresa o en el plan
    const isEnabled = configuracionModulos[featureName] === true || planFeatures[featureName] === true;

    if (!isEnabled) {
      return res.status(403).json({
        ok: false,
        message: `El módulo '${featureName}' no está contratado en su plan actual.`,
      });
    }

    return next();
  };
}
```

#### Aplicación en Rutas:
```javascript
// backend/src/routes/reporte.routes.js
const { Router } = require('express');
const { authGuard } = require('../middlewares/auth.middleware');
const { tenantGuard, subscriptionGuard } = require('../middlewares/tenant.middleware');
const { featureGuard } = require('../middlewares/tenant.middleware'); // Nuevo guard
const controller = require('../controllers/reporte.controller');

const router = Router();

// Endpoint restringido solo a empresas con el módulo de reportes avanzados
router.get(
  '/avanzado', 
  authGuard, 
  tenantGuard, 
  subscriptionGuard, 
  featureGuard('reportes_avanzados'), // <-- Validación del módulo
  controller.generateAdvancedReport
);
```

---

### Nivel 3: Frontend (Visualización Dinámica del Menú)

En el frontend, el archivo [navigation.js](file:///c:/Cursos/asistepro/frontend/src/config/navigation.js) y la barra lateral [Sidebar.jsx](file:///c:/Cursos/asistepro/frontend/src/components/layout/Sidebar.jsx) deben filtrar los ítems no solo por el rol, sino también por los módulos habilitados cargados en el perfil del usuario.

#### Paso 1: Configurar banderas en los items de navegación
```javascript
// frontend/src/config/navigation.js
export const navItems = [
  { 
    title: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    roles: routeRoles.empleado 
  },
  { 
    title: 'Reportes Especiales', 
    href: '/reportes/especiales', 
    icon: FileBarChart, 
    roles: routeRoles.rrhh, 
    feature: 'reportes_avanzados' // <-- Requiere este módulo habilitado
  },
  { 
    title: 'Justificaciones', 
    href: '/justificaciones', 
    icon: ShieldCheck, 
    roles: routeRoles.rrhh, 
    feature: 'justificaciones' 
  }
];
```

#### Paso 2: Filtrar dinámicamente en el render del Sidebar
Modificamos el filtro para leer el objeto `modulos` del usuario (el cual viaja en el payload del JWT tras el login).

```javascript
// frontend/src/components/layout/Sidebar.jsx
export default function Sidebar({ open, onNavigate, user }) {
  const location = useLocation();

  // Filtrar los items de navegación según rol Y módulos contratados
  const visibleItems = navItems.filter((item) => {
    // 1. Validar roles
    const hasRole = !item.roles?.length || item.roles.includes(user?.rol);
    if (!hasRole) return false;

    // 2. Si es SUPER_ADMIN o el item no tiene restricción de feature, permitir
    if (user?.rol === 'SUPER_ADMIN' || !item.feature) return true;

    // 3. Validar si el feature está activo en los datos de la empresa del usuario
    const modulosContratados = user?.modulos || {};
    return modulosContratados[item.feature] === true;
  });

  return (
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      {/* Renderizado de items visibleItems */}
    </aside>
  );
}
```

---

## 3. Interfaz del SUPER_ADMIN para Gestionar Accesos

Para que el `SUPER_ADMIN` pueda interactuar con esto, el panel de edición de **Empresas** ([EmpresaForm.jsx](file:///c:/Cursos/asistepro/frontend/src/pages/empresas/EmpresaForm.jsx)) debe incluir una sección de "Habilitación de Módulos" con checkboxes.

Al guardar, el backend recibe el JSON y lo guarda en `empresas.configuracion_modulos`. De esta forma, el cambio de accesos es inmediato tanto en la API como en la interfaz gráfica del cliente.
