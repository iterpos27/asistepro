BEGIN;

CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  sucursal_habitual_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  codigo VARCHAR(50) NOT NULL,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  email VARCHAR(160),
  telefono VARCHAR(40),
  cargo VARCHAR(120),
  departamento VARCHAR(120),
  fecha_ingreso DATE,
  estado VARCHAR(30) NOT NULL DEFAULT 'activo',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT empleados_estado_check CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  CONSTRAINT empleados_empresa_codigo_unique UNIQUE (empresa_id, codigo),
  CONSTRAINT empleados_empresa_email_unique UNIQUE (empresa_id, email)
);

CREATE INDEX IF NOT EXISTS idx_empleados_empresa_id ON empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_sucursal_habitual_id ON empleados(sucursal_habitual_id);
CREATE INDEX IF NOT EXISTS idx_empleados_usuario_id ON empleados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_empleados_estado ON empleados(estado);

COMMIT;
