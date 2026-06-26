BEGIN;

CREATE TABLE IF NOT EXISTS vacaciones_saldo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL,
  -- Days legally earned for this year based on seniority
  dias_derecho NUMERIC(5,2) NOT NULL DEFAULT 15,
  -- Manual/initial balance (set when registering employee or carrying over)
  saldo_inicial NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Days used via approved vacation requests (auto-updated)
  dias_tomados NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Free notes for HR
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacaciones_saldo_empleado_anio_unique UNIQUE (empresa_id, empleado_id, anio)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_saldo_empresa ON vacaciones_saldo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_saldo_empleado ON vacaciones_saldo(empleado_id);

COMMIT;
