BEGIN;

CREATE INDEX IF NOT EXISTS idx_marcaciones_empresa_fecha_estado_tipo
  ON marcaciones(empresa_id, marcado_en DESC, estado, tipo)
  WHERE anulada = FALSE;

CREATE INDEX IF NOT EXISTS idx_marcaciones_empresa_sucursal_fecha
  ON marcaciones(empresa_id, sucursal_id, marcado_en DESC)
  WHERE anulada = FALSE;

CREATE INDEX IF NOT EXISTS idx_marcaciones_empresa_empleado_tipo_fecha
  ON marcaciones(empresa_id, empleado_id, tipo, marcado_en DESC)
  WHERE anulada = FALSE;

CREATE INDEX IF NOT EXISTS idx_facturas_empresa_estado_vencimiento
  ON facturas(empresa_id, estado, fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_facturas_empresa_creado
  ON facturas(empresa_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_empresa_estado_pagado
  ON pagos(empresa_id, estado, pagado_en DESC);

CREATE INDEX IF NOT EXISTS idx_suscripciones_empresa_creado
  ON suscripciones(empresa_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_importaciones_empresa_creado
  ON importaciones_empleados(empresa_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_integraciones_empresa_estado
  ON integraciones_externas(empresa_id, estado);

CREATE SEQUENCE IF NOT EXISTS facturas_numero_seq;

SELECT setval(
  'facturas_numero_seq',
  GREATEST(COALESCE(invoice_numbers.max_numero, 1), 1),
  invoice_numbers.max_numero IS NOT NULL
)
FROM (
  SELECT MAX(NULLIF(regexp_replace(numero, '[^0-9]', '', 'g'), '')::bigint) AS max_numero
  FROM facturas
) invoice_numbers;

SELECT setval(
  'facturas_numero_seq',
  1,
  false
)
WHERE NOT EXISTS (
  SELECT 1 FROM facturas
);

COMMIT;
