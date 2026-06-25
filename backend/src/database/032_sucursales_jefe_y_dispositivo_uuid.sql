BEGIN;

-- 1. Add jefe_empleado_id to sucursales
ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS jefe_empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL;

-- 2. Add cedula to usuarios (for tenant registration admin)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);

-- 3. Add dispositivo_uuid to empleados
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS dispositivo_uuid VARCHAR(100);

-- 4. Create partial unique index on dispositivo_uuid to prevent sharing a device
CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_dispositivo_uuid_unique 
  ON empleados (empresa_id, dispositivo_uuid) 
  WHERE dispositivo_uuid IS NOT NULL;

COMMIT;
