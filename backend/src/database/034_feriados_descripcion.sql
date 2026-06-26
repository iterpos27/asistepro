BEGIN;

-- Add descripcion column to feriados table
ALTER TABLE feriados ADD COLUMN IF NOT EXISTS descripcion VARCHAR(500);

COMMIT;
