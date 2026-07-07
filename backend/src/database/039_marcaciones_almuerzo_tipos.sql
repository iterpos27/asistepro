BEGIN;

ALTER TABLE marcaciones
  DROP CONSTRAINT IF EXISTS marcaciones_tipo_check;

ALTER TABLE marcaciones
  ADD CONSTRAINT marcaciones_tipo_check
  CHECK (tipo IN ('entrada', 'salida_almuerzo', 'entrada_almuerzo', 'salida'));

COMMIT;
