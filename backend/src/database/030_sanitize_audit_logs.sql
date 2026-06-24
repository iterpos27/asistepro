-- Update existing routes in logs_auditoria to user-friendly modules
UPDATE logs_auditoria SET ruta = 'Seguridad y Acceso' WHERE ruta LIKE '/api/auth%' OR ruta LIKE '/auth%';
UPDATE logs_auditoria SET ruta = 'Gestión de Empleados' WHERE ruta LIKE '/api/empleados%' OR ruta LIKE '/empleados%';
UPDATE logs_auditoria SET ruta = 'Gestión de Empresas' WHERE ruta LIKE '/api/empresas%' OR ruta LIKE '/empresas%';
UPDATE logs_auditoria SET ruta = 'Facturación' WHERE ruta LIKE '/api/facturacion%' OR ruta LIKE '/facturacion%';
UPDATE logs_auditoria SET ruta = 'Estado del Sistema' WHERE ruta LIKE '/api/health%' OR ruta LIKE '/health%';
UPDATE logs_auditoria SET ruta = 'Gestión de Horarios' WHERE ruta LIKE '/api/horarios%' OR ruta LIKE '/horarios%';
UPDATE logs_auditoria SET ruta = 'Integraciones' WHERE ruta LIKE '/api/integraciones%' OR ruta LIKE '/integraciones%';
UPDATE logs_auditoria SET ruta = 'Control de Asistencia' WHERE ruta LIKE '/api/marcaciones%' OR ruta LIKE '/marcaciones%';
UPDATE logs_auditoria SET ruta = 'Estructura Organizacional' WHERE ruta LIKE '/api/organizacion%' OR ruta LIKE '/organizacion%';
UPDATE logs_auditoria SET ruta = 'Planes de Suscripción' WHERE ruta LIKE '/api/planes%' OR ruta LIKE '/planes%';
UPDATE logs_auditoria SET ruta = 'Reportes y Estadísticas' WHERE ruta LIKE '/api/reportes%' OR ruta LIKE '/reportes%';
UPDATE logs_auditoria SET ruta = 'Reemplazos y Coberturas' WHERE ruta LIKE '/api/reemplazos%' OR ruta LIKE '/reemplazos%';
UPDATE logs_auditoria SET ruta = 'Administración SaaS' WHERE ruta LIKE '/api/saas%' OR ruta LIKE '/saas%';
UPDATE logs_auditoria SET ruta = 'Notificaciones' WHERE ruta LIKE '/api/notificaciones%' OR ruta LIKE '/notificaciones%';
UPDATE logs_auditoria SET ruta = 'Suscripciones' WHERE ruta LIKE '/api/suscripciones%' OR ruta LIKE '/suscripciones%';
UPDATE logs_auditoria SET ruta = 'Gestión de Sucursales' WHERE ruta LIKE '/api/sucursales%' OR ruta LIKE '/sucursales%';
UPDATE logs_auditoria SET ruta = 'Configuración de Empresa' WHERE ruta LIKE '/api/tenant%' OR ruta LIKE '/tenant%';
UPDATE logs_auditoria SET ruta = 'Gestión de Usuarios' WHERE ruta LIKE '/api/usuarios%' OR ruta LIKE '/usuarios%';
UPDATE logs_auditoria SET ruta = 'Configuración Laboral' WHERE ruta LIKE '/api/laboral%' OR ruta LIKE '/laboral%';
UPDATE logs_auditoria SET ruta = 'Solicitudes y Permisos' WHERE ruta LIKE '/api/solicitudes%' OR ruta LIKE '/solicitudes%';
UPDATE logs_auditoria SET ruta = 'Auditoría de Cambios' WHERE ruta LIKE '/api/auditoria%' OR ruta LIKE '/auditoria%';

-- Catch-all for any technical path remaining
UPDATE logs_auditoria SET ruta = 'Sistema' WHERE ruta LIKE '/api/%' OR ruta LIKE '/%';

-- Clean up any UUID values stored in the entidad column of old logs
UPDATE logs_auditoria SET entidad = 'sucursales' WHERE entidad ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND (ruta = 'Gestión de Sucursales' OR accion ILIKE '%sucursal%');
UPDATE logs_auditoria SET entidad = 'empleados' WHERE entidad ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND (ruta = 'Gestión de Empleados' OR accion ILIKE '%empleado%');
UPDATE logs_auditoria SET entidad = 'usuarios' WHERE entidad ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND (ruta = 'Gestión de Usuarios' OR accion ILIKE '%usuario%');
UPDATE logs_auditoria SET entidad = 'empresas' WHERE entidad ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND (ruta = 'Gestión de Empresas' OR accion ILIKE '%empresa%');
UPDATE logs_auditoria SET entidad = 'recurso' WHERE entidad ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Update actions for login/logout/refresh/QR operations
UPDATE logs_auditoria SET accion = 'Inicio de sesión' WHERE accion ILIKE '%login%';
UPDATE logs_auditoria SET accion = 'Cierre de sesión' WHERE accion ILIKE '%logout%';
UPDATE logs_auditoria SET accion = 'Renovación de sesión' WHERE accion ILIKE '%refresh%';
UPDATE logs_auditoria SET accion = 'Generación de QR Dinámico' WHERE accion ILIKE '%qr/dynamic%';
UPDATE logs_auditoria SET accion = 'Rotación de QR' WHERE accion ILIKE '%qr/rotate%';

-- Update standard CRUD action strings
UPDATE logs_auditoria SET accion = 'Creación de ' || INITCAP(entidad) WHERE metodo = 'POST' AND (accion LIKE '%/%' OR accion LIKE '%-%' OR accion LIKE '% %' OR accion ILIKE '%ea1d%');
UPDATE logs_auditoria SET accion = 'Modificación de ' || INITCAP(entidad) WHERE metodo IN ('PUT', 'PATCH') AND (accion LIKE '%/%' OR accion LIKE '%-%' OR accion LIKE '% %' OR accion ILIKE '%ea1d%');
UPDATE logs_auditoria SET accion = 'Eliminación de ' || INITCAP(entidad) WHERE metodo = 'DELETE' AND (accion LIKE '%/%' OR accion LIKE '%-%' OR accion LIKE '% %' OR accion ILIKE '%ea1d%');
UPDATE logs_auditoria SET accion = 'Consulta de ' || INITCAP(entidad) WHERE metodo = 'GET' AND (accion LIKE '%/%' OR accion LIKE '%-%' OR accion LIKE '% %' OR accion ILIKE '%ea1d%');
UPDATE logs_auditoria SET accion = metodo || ' - ' || INITCAP(entidad) WHERE accion LIKE '%/%' OR accion LIKE '%-%' OR accion LIKE '% %';
