BEGIN;

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS pdf_storage_provider VARCHAR(40),
  ADD COLUMN IF NOT EXISTS pdf_storage_bucket VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pdf_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_url TEXT;

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS comprobante_storage_provider VARCHAR(40),
  ADD COLUMN IF NOT EXISTS comprobante_storage_bucket VARCHAR(120),
  ADD COLUMN IF NOT EXISTS comprobante_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS comprobante_storage_url TEXT;

COMMIT;
