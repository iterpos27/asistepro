BEGIN;

UPDATE usuarios
SET apellido = 'Dueñas'
WHERE email = 'juan.duenas@essart.com.ec' AND apellido = 'Duenas';

UPDATE empleados
SET apellidos = 'Dueñas',
    codigo = 'JUAN_DUEÑAS'
WHERE email = 'juan.duenas@essart.com.ec' AND apellidos = 'Duenas';

COMMIT;
