BEGIN;

CREATE TABLE IF NOT EXISTS facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  suscripcion_id UUID REFERENCES suscripciones(id) ON DELETE SET NULL,
  numero VARCHAR(40) NOT NULL UNIQUE,
  concepto VARCHAR(180) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  impuesto NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT facturas_estado_check CHECK (estado IN ('pendiente', 'pagada', 'anulada', 'vencida'))
);

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  monto NUMERIC(10, 2) NOT NULL,
  metodo VARCHAR(40) NOT NULL DEFAULT 'manual',
  referencia VARCHAR(120),
  nota TEXT,
  pagado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pagos_monto_check CHECK (monto > 0),
  CONSTRAINT pagos_metodo_check CHECK (metodo IN ('manual', 'transferencia', 'efectivo', 'tarjeta', 'otro'))
);

CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id ON facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_suscripcion_id ON facturas(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_empresa_id ON pagos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagos_factura_id ON pagos(factura_id);

COMMIT;
