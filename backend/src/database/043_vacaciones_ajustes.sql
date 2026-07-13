BEGIN;

CREATE TABLE IF NOT EXISTS vacaciones_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL,
  saldo_inicial_anterior NUMERIC(5,2) NOT NULL,
  saldo_inicial_nuevo NUMERIC(5,2) NOT NULL,
  dias_derecho_anterior NUMERIC(5,2) NOT NULL,
  dias_derecho_nuevo NUMERIC(5,2) NOT NULL,
  dias_tomados_anterior NUMERIC(5,2) NOT NULL,
  dias_tomados_nuevo NUMERIC(5,2) NOT NULL,
  motivo TEXT NOT NULL,
  ajustado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ajustado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_ajustes_empresa_empleado 
  ON vacaciones_ajustes(empresa_id, empleado_id);

COMMIT;
