BEGIN;

CREATE INDEX IF NOT EXISTS idx_marcaciones_reportes
ON marcaciones(empresa_id, empleado_id, marcado_en DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_factura_estado
ON pagos(factura_id, estado);

COMMIT;
