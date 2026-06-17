BEGIN;

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;

ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check CHECK (metodo IN ('manual', 'transferencia', 'deposito', 'efectivo', 'tarjeta', 'cheque', 'otro'));

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS banco VARCHAR(100);

COMMIT;
