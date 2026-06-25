BEGIN;

-- Add username column to usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;

-- Create feriados table
CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(160) NOT NULL,
  fecha DATE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feriados_empresa_fecha_unique UNIQUE (empresa_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_feriados_empresa_id ON feriados(empresa_id);

COMMIT;
