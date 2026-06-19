BEGIN;

-- 1. Empresas
UPDATE empresas
SET nombre = 'Empresa Demo S.A.',
    identificacion_fiscal = '1790000000001',
    email = 'contacto@empresademo.local',
    direccion = 'Av. Principal N12-34 y Calle Secundaria, Quito'
WHERE nombre ILIKE '%rulim%' OR nombre ILIKE '%centro del%';

-- 2. Sucursales
UPDATE sucursales
SET nombre = 'Sucursal Principal',
    direccion = 'Av. Principal N12-34 y Calle Secundaria, Quito',
    ciudad = 'Quito'
WHERE nombre ILIKE '%rulim%' OR nombre ILIKE '%centro del%'
   OR direccion ILIKE '%rulim%' OR direccion ILIKE '%centro del%';

-- 3. Usuarios
UPDATE usuarios
SET nombre = 'Usuario',
    apellido = 'General',
    email = 'usuario.demo@asistepro.local'
WHERE email ILIKE '%rulim%' OR email ILIKE '%centro%';

-- 4. Empleados
UPDATE empleados
SET nombres = 'Empleado',
    apellidos = 'Demo',
    email = 'empleado.demo@asistepro.local',
    cargo = 'Asistente General',
    departamento = 'Administración'
WHERE email ILIKE '%rulim%' OR email ILIKE '%centro%'
   OR cargo ILIKE '%rulim%' OR cargo ILIKE '%centro%'
   OR departamento ILIKE '%rulim%' OR departamento ILIKE '%centro%';

-- 5. Facturas
UPDATE facturas
SET concepto = 'Suscripción Mensual SaaS'
WHERE concepto ILIKE '%rulim%' OR concepto ILIKE '%centro%';

-- 6. Pagos
UPDATE pagos
SET nota = 'Pago de suscripción'
WHERE nota ILIKE '%rulim%' OR nota ILIKE '%centro%';

COMMIT;
