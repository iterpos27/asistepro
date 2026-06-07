BEGIN;

CREATE TABLE IF NOT EXISTS marcaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  horario_id UUID REFERENCES horarios(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL,
  estado VARCHAR(40) NOT NULL,
  latitud NUMERIC(10, 7) NOT NULL,
  longitud NUMERIC(10, 7) NOT NULL,
  distancia_metros NUMERIC(10, 2) NOT NULL,
  dentro_geocerca BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_novedad VARCHAR(120),
  detalle_novedad TEXT,
  mensaje TEXT,
  marcado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marcaciones_tipo_check CHECK (tipo IN ('entrada', 'salida')),
  CONSTRAINT marcaciones_estado_check CHECK (
    estado IN ('aceptada', 'aceptada_con_novedad', 'rechazada')
  ),
  CONSTRAINT marcaciones_latitud_check CHECK (latitud >= -90 AND latitud <= 90),
  CONSTRAINT marcaciones_longitud_check CHECK (longitud >= -180 AND longitud <= 180)
);

CREATE INDEX IF NOT EXISTS idx_marcaciones_empresa_id ON marcaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_marcaciones_empleado_id ON marcaciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_marcaciones_sucursal_id ON marcaciones(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_marcaciones_horario_id ON marcaciones(horario_id);
CREATE INDEX IF NOT EXISTS idx_marcaciones_estado ON marcaciones(estado);
CREATE INDEX IF NOT EXISTS idx_marcaciones_marcado_en ON marcaciones(marcado_en);

COMMIT;
