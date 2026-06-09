# Menús por rol y control de módulos en AsistePro

Documento de referencia: estructura profesional de navegación por rol y diseño para que el superadmin controle qué módulos ve cada empresa/usuario.

---

## Estado actual (resumen)

El proyecto ya tiene una base sólida:

- 4 roles fijos: `SUPER_ADMIN`, `ADMIN_EMPRESA`, `RRHH`, `EMPLEADO`
- Menú filtrado por rol en el sidebar (`frontend/src/config/navigation.js`)
- `roleGuard` en el backend (`backend/src/middlewares/auth.middleware.js`)

**Archivos clave:**

| Archivo | Responsabilidad |
|---------|-----------------|
| `frontend/src/utils/roles.js` | Definición de roles y `routeRoles` |
| `frontend/src/config/navigation.js` | Ítems del menú lateral |
| `frontend/src/config/routes.js` | Rutas privadas y roles permitidos |
| `frontend/src/components/layout/Sidebar.jsx` | Filtrado visual del menú |
| `backend/src/middlewares/auth.middleware.js` | `authGuard` + `roleGuard` |
| `backend/src/middlewares/tenant.middleware.js` | Contexto de empresa / plan |

**Problema actual:** `SUPER_ADMIN` hereda todo vía `routeRoles.empleado`, incluido "Marcar" y "Mis marcaciones", que no encajan con su rol operativo. El menú es una lista plana sin secciones.

```javascript
// frontend/src/utils/roles.js (situación actual)
export const routeRoles = {
  superAdmin: [ROLES.SUPER_ADMIN],
  adminEmpresa: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA],
  rrhh: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH],
  empleado: [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO],
};
```

---

## Principio profesional: 3 contextos de navegación

| Contexto | Quién | Propósito |
|----------|-------|-----------|
| **Plataforma** | Super admin | SaaS: empresas, planes, suscripciones, facturación global |
| **Empresa (tenant)** | Admin empresa, RRHH | Operación diaria de una empresa |
| **Personal** | Todos (según rol) | Marcar, historial propio, perfil |

Un buen menú no es "más ítems para roles superiores", sino **ítems distintos según el trabajo** de cada persona.

---

## Menú recomendado por rol

### 1. SUPER_ADMIN — Operador de plataforma

**No debería ver** Marcar / Mis marcaciones como menú principal. Opera en modo plataforma; si necesita revisar una empresa, entra con **selector de empresa** (ya existe `x-empresa-id` en tenant middleware).

```
📊 Plataforma
   ├── Dashboard (MRR, empresas activas, suscripciones, pagos pendientes)
   ├── Empresas
   ├── Planes
   ├── Suscripciones
   └── Facturación (global)

⚙️ Sistema
   ├── Usuarios plataforma (futuro)
   ├── Auditoría / logs (futuro)
   └── Ajustes plataforma
```

**Landing:** `/dashboard` con métricas SaaS.

---

### 2. ADMIN_EMPRESA — Dueño / gerente del tenant

Ve todo lo operativo de **su** empresa + facturación y configuración.

```
📊 Resumen
   └── Dashboard (KPIs empresa: asistencia, empleados, sucursales)

🏢 Organización
   ├── Sucursales
   ├── Empleados
   └── Horarios

📋 Operación
   ├── Marcaciones (supervisión, no marcar propio salvo que también sea empleado)
   └── Reportes

💳 Suscripción
   ├── Mi plan / suscripción
   └── Facturación

⚙️ Configuración
   ├── Datos de empresa
   ├── Usuarios y roles (futuro: invitar admin/RRHH)
   └── Ajustes
```

**Landing:** `/dashboard` con vista empresa.

**Nota:** Hoy `Horarios` solo está en menú RRHH, pero el dashboard de admin ya consulta horarios. Conviene que **admin también lo vea** en el menú.

---

### 3. RRHH — Operador de personas y asistencia

Enfocado en gestión diaria, **sin** facturación ni configuración de empresa.

```
📊 Resumen
   └── Dashboard (asistencia del día, novedades, ausencias)

👥 Personal
   ├── Empleados
   ├── Horarios
   └── Sucursales (lectura o edición limitada)

📋 Asistencia
   ├── Marcaciones (consulta / corrección)
   └── Reportes

🕐 Mi asistencia (opcional)
   ├── Marcar
   └── Mis marcaciones

⚙️ Ajustes (solo perfil)
```

**Landing:** `/dashboard` o `/reportes` si el foco es monitoreo.

**Diferencia con Admin:** sin Facturación, sin "Usuarios y roles", sin editar datos fiscales de la empresa.

---

### 4. EMPLEADO — Usuario final

Menú mínimo, acción principal visible.

```
🕐 Asistencia
   ├── Marcar          ← acción principal, primero en el menú
   └── Mis marcaciones

📊 Resumen (opcional)
   └── Dashboard personal (horas, últimas marcaciones)

⚙️ Ajustes (solo perfil)
```

**Landing:** `/marcaciones` (no `/dashboard` genérico).

---

## Cómo debería verse el menú (estructura en código)

En lugar de una lista plana en `navigation.js`, usar **grupos por sección**:

```javascript
export const navSections = [
  {
    id: 'platform',
    label: 'Plataforma',
    roles: ['SUPER_ADMIN'],
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Empresas', href: '/empresas', icon: Building2 },
      // ...
    ],
  },
  {
    id: 'organization',
    label: 'Organización',
    roles: ['ADMIN_EMPRESA', 'RRHH'],
    items: [
      // sucursales, empleados, horarios
    ],
  },
  {
    id: 'attendance',
    label: 'Asistencia',
    roles: ['EMPLEADO'],
    items: [
      // marcar, mis marcaciones
    ],
  },
];
```

En `Sidebar.jsx`, filtrar por `user.rol` **y** por módulos habilitados (ver sección siguiente).

---

## Cómo hacer que el superadmin controle módulos

Hay **dos capas** que no deben mezclarse:

| Capa | Pregunta que responde | Quién configura |
|------|----------------------|-----------------|
| **Rol (RBAC)** | ¿Qué puede hacer este tipo de usuario? | Sistema (fijo) + asignación de rol al crear usuario |
| **Módulo (feature)** | ¿Esta empresa tiene contratado/habilitado X? | Super admin (y a veces el plan) |

> **Importante:** La seguridad real va en el **backend**. El menú solo oculta opciones; no es autorización.

### Modelo recomendado (3 niveles)

```
Catálogo de módulos
        ↓
Plan: módulos incluidos
        ↓
Suscripción de la empresa
        ↓
Override por empresa (Super Admin)
        ↓
Rol: permisos dentro del módulo
        ↓
Usuario ve menú y API responde
```

#### 1. Catálogo de módulos (base de datos)

```sql
CREATE TABLE modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,  -- 'EMPLEADOS', 'REPORTES', 'FACTURACION'
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT
);

CREATE TABLE plan_modulos (
  plan_id UUID REFERENCES planes(id),
  modulo_id UUID REFERENCES modulos(id),
  PRIMARY KEY (plan_id, modulo_id)
);

-- Override que solo superadmin puede tocar
CREATE TABLE empresa_modulos (
  empresa_id UUID REFERENCES empresas(id),
  modulo_id UUID REFERENCES modulos(id),
  habilitado BOOLEAN NOT NULL DEFAULT TRUE,
  configurado_por UUID REFERENCES usuarios(id),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (empresa_id, modulo_id)
);
```

**Lógica:** un módulo está activo para una empresa si:

- está en el plan de su suscripción activa, **y**
- no está deshabilitado en `empresa_modulos` (override del superadmin).

**Ejemplos de códigos de módulo:**

| Código | Descripción |
|--------|-------------|
| `EMPLEADOS` | Gestión de empleados |
| `SUCURSALES` | Gestión de sucursales |
| `HORARIOS` | Horarios y asignaciones |
| `MARCACIONES` | Registro y consulta de asistencia |
| `REPORTES` | Reportes y novedades |
| `FACTURACION` | Facturas y pagos del tenant |

#### 2. Permisos por rol (opcional pero profesional)

```sql
CREATE TABLE rol_permisos (
  rol_id UUID REFERENCES roles(id),
  modulo_codigo VARCHAR(50) NOT NULL,
  accion VARCHAR(20) NOT NULL,  -- 'ver', 'crear', 'editar', 'eliminar'
  PRIMARY KEY (rol_id, modulo_codigo, accion)
);
```

**Ejemplo:**

| Rol | Módulo | Acciones |
|-----|--------|----------|
| RRHH | EMPLEADOS | ver, crear, editar |
| RRHH | FACTURACION | — |
| ADMIN_EMPRESA | EMPLEADOS | todas |
| ADMIN_EMPRESA | FACTURACION | ver, pagar |

#### 3. Middleware en backend

Encadenar guards como ya se hace con `tenantGuard` y `planGuard`:

```javascript
function moduleGuard(moduloCodigo) {
  return async (req, res, next) => {
    if (req.auth.rol === 'SUPER_ADMIN') return next(); // bypass plataforma

    const habilitado = await tenantService.isModuloHabilitado(
      req.tenant.empresa_id,
      moduloCodigo
    );
    if (!habilitado) {
      return res.status(403).json({ ok: false, message: 'Módulo no habilitado' });
    }
    return next();
  };
}

// Uso en rutas
router.get(
  '/empleados',
  authGuard,
  tenantGuard,
  moduleGuard('EMPLEADOS'),
  roleGuard(['ADMIN_EMPRESA', 'RRHH']),
  empleadoController.list
);
```

#### 4. Respuesta de `/auth/me` enriquecida

Al login y en `GET /auth/me`, devolver:

```json
{
  "user": { "rol": "RRHH", "empresa_id": "..." },
  "modulos": ["EMPLEADOS", "HORARIOS", "MARCACIONES", "REPORTES"],
  "permisos": ["empleados:ver", "empleados:crear", "reportes:ver"]
}
```

El frontend filtra menú y botones con esos datos.

#### 5. UI para que el superadmin configure

Pantalla **Empresa → Módulos** (solo superadmin):

- Checklist de módulos con estado: incluido en plan / habilitado / deshabilitado por override.
- Al desactivar "Reportes", desaparece del menú de esa empresa y la API devuelve 403.
- Opcional: pantalla **Planes → Módulos** para definir qué trae cada plan (Starter sin reportes avanzados, etc.).

---

## Cambios concretos sugeridos en el código actual

### Menú / roles

1. **Quitar `SUPER_ADMIN` de `routeRoles.empleado`** para ítems personales (Marcar, Mis marcaciones, Ajustes genérico).
2. **Añadir `ADMIN_EMPRESA` a Horarios** en `navigation.js`.
3. **Landing por rol** en `AppRoutes.jsx`:
   - `EMPLEADO` → `/marcaciones`
   - `SUPER_ADMIN` → `/dashboard`
4. **Agrupar el sidebar** por secciones según contexto.

### Permisos

5. Tablas `modulos`, `plan_modulos`, `empresa_modulos` (+ opcional `rol_permisos`).
6. `moduleGuard` en rutas tenant.
7. Extender `sanitizeUser` / `/auth/me` con `modulos` y `permisos`.
8. Filtrar `navItems` con `user.modulos.includes('REPORTES')`.

### Separar responsabilidades del superadmin

9. Superadmin en rutas **plataforma** (`/empresas`, `/planes`) sin `tenantGuard`.
10. Superadmin en rutas **tenant** solo con empresa seleccionada y, si se desea, sin poder "marcar" como empleado.

---

## Matriz resumen (referencia rápida)

| Módulo / Menú | Super Admin | Admin Empresa | RRHH | Empleado |
|---------------|:-----------:|:-------------:|:----:|:--------:|
| Dashboard plataforma | ✅ | — | — | — |
| Empresas / Planes / Suscripciones globales | ✅ | — | — | — |
| Dashboard empresa | ✅* | ✅ | ✅ | opcional |
| Sucursales | ✅* | ✅ | ✅ lectura/edición | — |
| Empleados | ✅* | ✅ | ✅ | — |
| Horarios | ✅* | ✅ | ✅ | — |
| Marcaciones (supervisión) | ✅* | ✅ | ✅ | — |
| Reportes | ✅* | ✅ | ✅ | — |
| Marcar / Mis marcaciones | — | opcional | opcional | ✅ |
| Facturación | ✅ global | ✅ su empresa | — | — |
| Config empresa / usuarios | — | ✅ | — | — |
| Ajustes perfil | ✅ | ✅ | ✅ | ✅ |

\* Solo cuando opera en contexto de una empresa seleccionada.

---

## Orden de implementación sugerido

| Fase | Alcance | Impacto |
|------|---------|---------|
| **1** | Refactor menú (secciones + quitar ítems incorrectos del superadmin) | UX inmediato |
| **2** | Catálogo de módulos + `empresa_modulos` | Superadmin habilita/deshabilita por empresa |
| **3** | `moduleGuard` en API | Seguridad real |
| **4** | `/auth/me` con módulos | Menú dinámico en frontend |
| **5** | `rol_permisos` | Granularidad fina (quién edita vs solo ve) |

---

## Referencias en el repositorio

- Roles frontend: `frontend/src/utils/roles.js`
- Navegación: `frontend/src/config/navigation.js`
- Rutas: `frontend/src/config/routes.js`
- Sidebar: `frontend/src/components/layout/Sidebar.jsx`
- Auth backend: `backend/src/services/auth.service.js`
- Guards: `backend/src/middlewares/auth.middleware.js`, `backend/src/middlewares/tenant.middleware.js`
- Schema roles: `backend/src/database/001_schema.sql`, `backend/src/database/002_seed_planes.sql`
