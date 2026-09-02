BEGIN;

ALTER TABLE marcaciones
  ADD COLUMN IF NOT EXISTS integracion_id UUID REFERENCES integraciones_externas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen_referencia VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marcaciones_integracion_referencia
  ON marcaciones(integracion_id, origen_referencia)
  WHERE integracion_id IS NOT NULL AND origen_referencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marcaciones_integracion
  ON marcaciones(integracion_id, marcado_en DESC)
  WHERE integracion_id IS NOT NULL;

COMMIT;
