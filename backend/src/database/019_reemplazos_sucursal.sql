BEGIN;

CREATE TABLE IF NOT EXISTS reemplazos_sucursal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  autorizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  motivo VARCHAR(160) NOT NULL,
  observacion TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reemplazos_estado_check CHECK (estado IN ('activo', 'cancelado', 'finalizado')),
  CONSTRAINT reemplazos_fechas_check CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT reemplazos_horas_check CHECK (
    hora_inicio IS NULL
    OR hora_fin IS NULL
    OR hora_fin > hora_inicio
  )
);

CREATE INDEX IF NOT EXISTS idx_reemplazos_empresa_estado ON reemplazos_sucursal(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_reemplazos_empleado_sucursal ON reemplazos_sucursal(empresa_id, empleado_id, sucursal_id);
CREATE INDEX IF NOT EXISTS idx_reemplazos_fechas ON reemplazos_sucursal(fecha_inicio, fecha_fin);

UPDATE empresas
SET configuracion_modulos = COALESCE(configuracion_modulos, '{}'::jsonb) || '{"reemplazos": true}'::jsonb;

UPDATE usuarios
SET configuracion_modulos = COALESCE(configuracion_modulos, '{}'::jsonb) || '{"reemplazos": true}'::jsonb
WHERE NOT (COALESCE(configuracion_modulos, '{}'::jsonb) ? 'reemplazos');

COMMIT;
