BEGIN;

ALTER TABLE pagos
DROP CONSTRAINT IF EXISTS pagos_estado_check;

ALTER TABLE pagos
ADD CONSTRAINT pagos_estado_check CHECK (estado IN ('pendiente', 'registrado', 'anulado'));

COMMIT;
