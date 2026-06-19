BEGIN;

ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS limite_importaciones_mensuales INTEGER,
  ADD COLUMN IF NOT EXISTS limite_almacenamiento_mb INTEGER,
  ADD COLUMN IF NOT EXISTS limite_integraciones INTEGER,
  ADD COLUMN IF NOT EXISTS soporte_pwa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS soporte_biometrico BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS soporte_nomina BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS estructuras_organizacionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES estructuras_organizacionales(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  descripcion TEXT,
  responsable_empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT estructuras_tipo_check CHECK (tipo IN ('direccion', 'departamento', 'area', 'cargo', 'centro_costo', 'unidad'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estructuras_empresa_tipo_codigo
  ON estructuras_organizacionales(empresa_id, tipo, codigo);
CREATE INDEX IF NOT EXISTS idx_estructuras_empresa_parent
  ON estructuras_organizacionales(empresa_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_estructuras_empresa_tipo
  ON estructuras_organizacionales(empresa_id, tipo);

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS area_estructura_id UUID REFERENCES estructuras_organizacionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cargo_estructura_id UUID REFERENCES estructuras_organizacionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_estructura_id UUID REFERENCES estructuras_organizacionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(50),
  ADD COLUMN IF NOT EXISTS salario_base NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_empleados_area_estructura_id ON empleados(area_estructura_id);
CREATE INDEX IF NOT EXISTS idx_empleados_cargo_estructura_id ON empleados(cargo_estructura_id);
CREATE INDEX IF NOT EXISTS idx_empleados_centro_costo_estructura_id ON empleados(centro_costo_estructura_id);
CREATE INDEX IF NOT EXISTS idx_empleados_supervisor_empleado_id ON empleados(supervisor_empleado_id);

CREATE TABLE IF NOT EXISTS importaciones_empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'procesada',
  filas_totales INTEGER NOT NULL DEFAULT 0,
  filas_creadas INTEGER NOT NULL DEFAULT 0,
  filas_actualizadas INTEGER NOT NULL DEFAULT 0,
  filas_con_error INTEGER NOT NULL DEFAULT 0,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  storage_provider VARCHAR(40),
  storage_bucket VARCHAR(120),
  storage_key TEXT,
  storage_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT importaciones_empleados_estado_check CHECK (estado IN ('procesada', 'procesada_con_errores', 'fallida'))
);

CREATE INDEX IF NOT EXISTS idx_importaciones_empleados_empresa_id ON importaciones_empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_importaciones_empleados_creado_en ON importaciones_empleados(creado_en DESC);

CREATE TABLE IF NOT EXISTS integraciones_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(160) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  proveedor VARCHAR(80) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'activa',
  api_key_hash TEXT,
  configuracion JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultima_sincronizacion_en TIMESTAMPTZ,
  ultima_ejecucion_estado VARCHAR(30),
  ultima_ejecucion_resumen JSONB,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  actualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT integraciones_externas_tipo_check CHECK (tipo IN ('nomina', 'biometrico', 'storage')),
  CONSTRAINT integraciones_externas_estado_check CHECK (estado IN ('activa', 'inactiva', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_integraciones_externas_empresa_id ON integraciones_externas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_integraciones_externas_tipo ON integraciones_externas(empresa_id, tipo);

CREATE TABLE IF NOT EXISTS integracion_ejecuciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracion_id UUID NOT NULL REFERENCES integraciones_externas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ejecutado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  accion VARCHAR(40) NOT NULL,
  estado VARCHAR(30) NOT NULL,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT integracion_ejecuciones_estado_check CHECK (estado IN ('ok', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_integracion_ejecuciones_integracion_id
  ON integracion_ejecuciones(integracion_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS notificaciones_push_suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notificaciones_push_endpoint_unique UNIQUE (endpoint)
);

UPDATE planes
SET
  limite_importaciones_mensuales = COALESCE(limite_importaciones_mensuales,
    CASE codigo WHEN 'starter' THEN 1 WHEN 'growth' THEN 4 ELSE 20 END),
  limite_almacenamiento_mb = COALESCE(limite_almacenamiento_mb,
    CASE codigo WHEN 'starter' THEN 256 WHEN 'growth' THEN 1024 ELSE 5120 END),
  limite_integraciones = COALESCE(limite_integraciones,
    CASE codigo WHEN 'starter' THEN 1 WHEN 'growth' THEN 3 ELSE 10 END),
  soporte_pwa = COALESCE(soporte_pwa, TRUE),
  soporte_biometrico = COALESCE(soporte_biometrico, codigo IN ('growth', 'enterprise')),
  soporte_nomina = COALESCE(soporte_nomina, codigo = 'enterprise');

COMMIT;
