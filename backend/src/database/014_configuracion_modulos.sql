BEGIN;

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS configuracion_modulos JSONB DEFAULT '{}'::jsonb;

COMMIT;
