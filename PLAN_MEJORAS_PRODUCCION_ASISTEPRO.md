# Plan de Mejoras para Produccion - AsistePro

Este documento consolida las mejoras que deben aplicarse antes y despues de pasar a produccion. Esta dividido en tres ejes: seguridad y vulnerabilidad, cumplimiento normativo, y rendimiento financiero/operativo.

## 1. Seguridad y Vulnerabilidad

### Prioridad alta

1. Endurecer autenticacion y sesion
   - Mantener refresh token solo en cookie HTTP-only.
   - Mantener access token solo en memoria del navegador.
   - Eliminar cualquier persistencia de tokens en `localStorage`.
   - Exigir CSRF en endpoints de sesion basados en cookie (`refresh`, `logout`).
   - Criterio de aceptacion: al recargar la pagina se restaura sesion por cookie; `localStorage` no contiene access token ni refresh token.

2. Blindar migraciones y despliegues
   - No marcar migraciones incrementales como aplicadas si no se ejecutaron.
   - Ejecutar migraciones en una fase explicita del despliegue.
   - Agregar respaldo obligatorio antes de migrar produccion.
   - Criterio de aceptacion: `schema_migrations` refleja exactamente los SQL ejecutados.

3. QR dinamico y control de tokens
   - Usar tokens con expiracion corta.
   - Registrar primer uso con `usado_en` para trazabilidad.
   - Limpiar tokens vencidos de forma periodica.
   - Mantener el QR estatico solo como compatibilidad temporal y desactivarlo cuando la app movil/web este lista.
   - Criterio de aceptacion: marcacion con token vencido falla; token vigente funciona; auditoria conserva emision/uso.

4. Validacion declarativa en todo el backend
   - Migrar validaciones manuales a Zod en rutas de empresas, empleados, horarios, facturacion, planes y suscripciones.
   - Normalizar `params`, `query` y `body` antes de entrar a controladores.
   - Criterio de aceptacion: payload invalido devuelve `400` con lista de campos.

5. Pruebas de permisos multi-tenant
   - Probar que un usuario de una empresa no pueda leer ni modificar recursos de otra.
   - Probar facturas, pagos, empleados, sucursales, horarios, reportes y comprobantes.
   - Criterio de aceptacion: suite automatizada con casos `403` para acceso cruzado.

### Prioridad media

1. Rate limiting por tipo de endpoint
   - Login: limite estricto.
   - Marcaciones: limite por usuario/empresa.
   - Reportes/exportaciones: limite por rol y rango de fechas.

2. Politica de logs segura
   - Evitar PII sensible en logs.
   - Registrar `request_id` por peticion.
   - Separar logs tecnicos de auditoria.

3. Headers y CORS de produccion
   - Definir `CORS_ORIGIN` exacto por ambiente.
   - Revisar `helmet` y politicas CSP si se agregan recursos externos.

## 2. Cumplimiento Normativo

### Prioridad alta

1. Auditoria funcional completa
   - Registrar altas, ediciones, desactivaciones y anulaciones.
   - Guardar usuario, empresa, entidad, accion, fecha, IP y metadata minima.
   - Criterio de aceptacion: cada operacion critica genera un registro en `logs_auditoria`.

2. Politica de retencion de datos
   - Definir retencion de marcaciones, comprobantes, auditoria y tokens.
   - Separar datos operativos de datos historicos.
   - Criterio de aceptacion: documento de retencion aprobado y tareas de limpieza programadas.

3. Proteccion de datos personales
   - Clasificar datos: empleados, ubicacion GPS, asistencia, facturacion y comprobantes.
   - Minimizar exposicion de coordenadas y archivos.
   - Criterio de aceptacion: endpoints devuelven solo campos necesarios para cada rol.

4. Trazabilidad de cambios de facturacion
   - Registrar aprobacion, anulacion y carga de comprobantes.
   - Conservar motivo de anulacion.
   - Criterio de aceptacion: pagos/facturas tienen historial auditable por usuario y fecha.

### Prioridad media

1. Consentimiento y aviso de geolocalizacion
   - Mostrar aviso claro antes de solicitar GPS.
   - Explicar finalidad: control de asistencia y validacion de geocerca.

2. Exportaciones controladas
   - Registrar exportaciones CSV/PDF.
   - Limitar rangos grandes por rol.
   - Evitar descargas masivas sin auditoria.

3. Roles y matriz de permisos
   - Documentar permisos por rol: `SUPER_ADMIN`, `ADMIN_EMPRESA`, `RRHH`, `EMPLEADO`.
   - Convertir permisos en tests automatizados.

## 3. Rendimiento Financiero y Operativo

### Prioridad alta

1. Rediseñar frontend con el sistema visual aprobado
   - Usar como base `asistepro_saas_docs/asiste-pro-saa-s-platform`.
   - Portar patrones de `Topbar`, `SidebarNav`, `Card`, `Table`, `DropdownMenu`, `Avatar`, `PageHeader`, `KpiCard` y `CheckInWidget`.
   - Criterio de aceptacion: todas las pantallas usan componentes compartidos; no hay estilos aislados por pagina salvo casos justificados.

2. Dashboard por rol
   - `SUPER_ADMIN`: empresas, suscripciones, pagos, vencimientos y alertas.
   - `ADMIN_EMPRESA`: asistencia diaria, sucursales, empleados, horarios, novedades.
   - `RRHH`: novedades, atrasos, marcaciones y empleados.
   - `EMPLEADO`: widget de marcacion, horario actual e historial.
   - Criterio de aceptacion: cada rol ve solo metricas accionables.

3. Facturacion operativa
   - Mejorar calculo de numero de factura para evitar colisiones por concurrencia.
   - Agregar metricas: MRR, facturas vencidas, pagos pendientes, tasa de cobranza.
   - Criterio de aceptacion: dashboard financiero muestra deuda, cobro y estado por empresa.

4. Reportes escalables
   - Implementar streaming para CSV grandes.
   - Agregar limites de fecha y paginacion consistente.
   - Criterio de aceptacion: exportaciones grandes no cargan todo en memoria.

### Prioridad media

1. Cache operativo
   - Cachear sucursales, geocercas y horarios activos.
   - Invalidar cache al editar sucursal u horario.

2. Observabilidad
   - Medir latencia por endpoint.
   - Registrar errores por modulo.
   - Agregar health check de base de datos.

3. Automatizacion de QA
   - Agregar Playwright para login, navegacion, dropdown perfil, CRUD, pagos, QR y responsive.
   - Mantener smoke test actual como verificacion rapida, no como garantia de produccion.

## Orden de Implementacion Recomendado

1. Seguridad de sesion, CSRF, migraciones y tests multi-tenant.
2. Redisenar layout base completo con componentes reutilizables.
3. Redisenar pantallas por modulo usando el sistema visual aprobado.
4. Fortalecer facturacion/reportes para produccion.
5. Agregar cumplimiento: retencion, auditoria visible, exportaciones auditadas.
6. Agregar observabilidad, caching y pruebas E2E.

## Evidencia y Comandos Minimos

Antes de publicar:

```powershell
npm.cmd run migrate
npm.cmd run check
npm.cmd audit --audit-level=moderate
cd frontend
npm.cmd run build
npm.cmd run test
npm.cmd audit --audit-level=moderate
```

## Estado Actual de Esta Iteracion

Aplicado en codigo:

- Sesion frontend sin persistir access/refresh token en `localStorage`.
- Bootstrap de sesion por refresh cookie.
- CSRF para refresh/logout cuando se usa cookie.
- Baseline de migraciones corregido para no omitir migraciones incrementales.
- Nueva migracion de limpieza e indices para tokens QR dinamicos.
- Registro de primer uso de token QR dinamico.
- Redisenio base del shell frontend: sidebar, topbar contextual, dropdown de perfil/salida y estilos compartidos de paneles/tablas/cards.
- Validadores Zod agregados a empresas, empleados, horarios/asignaciones y facturacion/pagos.
- Auditoria funcional enriquecida con metadata sanitizada de `params`, `query`, `body` y actor.
- Suite `npm run test` agregada para aislamiento multi-tenant y auditoria segura.

Pendiente:

- Portar componentes visuales finos pantalla por pantalla cuando la carpeta de referencia vuelva a su ubicacion versionada.
- Extender validadores Zod a planes, suscripciones, reportes y endpoints auxiliares.
- Agregar Playwright E2E con navegador real para login, CRUD, dropdown perfil, QR, pagos y responsive.
- Implementar retencion/limpieza periodica fuera del flujo de emision QR.
- Redisenar dashboard financiero y reportes escalables.
