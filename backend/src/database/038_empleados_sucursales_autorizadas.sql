BEGIN;

CREATE TABLE IF NOT EXISTS empleado_sucursales_autorizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT empleado_sucursales_autorizadas_unique UNIQUE (empresa_id, empleado_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_empleado_sucursales_autorizadas_empleado
  ON empleado_sucursales_autorizadas(empresa_id, empleado_id)
  WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_empleado_sucursales_autorizadas_sucursal
  ON empleado_sucursales_autorizadas(empresa_id, sucursal_id)
  WHERE activo = TRUE;

COMMIT;
