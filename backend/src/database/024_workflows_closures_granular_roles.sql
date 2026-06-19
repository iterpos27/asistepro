BEGIN;

CREATE TABLE IF NOT EXISTS roles_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  rol_base VARCHAR(40) NOT NULL,
  permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_personalizados_base_check CHECK (rol_base IN ('ADMIN_EMPRESA', 'RRHH', 'EMPLEADO')),
  CONSTRAINT roles_personalizados_empresa_nombre_unique UNIQUE (empresa_id, nombre)
);

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS configuracion_permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rol_personalizado_id UUID REFERENCES roles_personalizados(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  solicitado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo VARCHAR(40) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  datos_correccion JSONB,
  revisado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_en TIMESTAMPTZ,
  comentario_revision TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT solicitudes_tipo_check CHECK (tipo IN ('vacaciones', 'permiso', 'incapacidad', 'ausencia', 'correccion_marcacion')),
  CONSTRAINT solicitudes_estado_check CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  CONSTRAINT solicitudes_fechas_check CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT solicitudes_horas_check CHECK ((hora_inicio IS NULL AND hora_fin IS NULL) OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL)),
  CONSTRAINT solicitudes_correccion_check CHECK (tipo <> 'correccion_marcacion' OR datos_correccion IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS cierres_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  mes VARCHAR(7) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'cerrado',
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  detalle JSONB NOT NULL DEFAULT '[]'::jsonb,
  cerrado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  cerrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reabierto_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  reabierto_en TIMESTAMPTZ,
  motivo_reapertura TEXT,
  CONSTRAINT cierres_mensuales_mes_check CHECK (mes ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT cierres_mensuales_estado_check CHECK (estado IN ('cerrado', 'reabierto')),
  CONSTRAINT cierres_mensuales_empresa_mes_unique UNIQUE (empresa_id, mes)
);

ALTER TABLE marcaciones
  ADD COLUMN IF NOT EXISTS origen VARCHAR(30) NOT NULL DEFAULT 'qr',
  ADD COLUMN IF NOT EXISTS anulada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS corregida_solicitud_id UUID REFERENCES solicitudes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roles_personalizados_empresa ON roles_personalizados(empresa_id, activo);
CREATE INDEX IF NOT EXISTS idx_solicitudes_empresa_estado ON solicitudes(empresa_id, estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_empleado_fecha ON solicitudes(empleado_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_cierres_mensuales_empresa_mes ON cierres_mensuales(empresa_id, mes);
CREATE INDEX IF NOT EXISTS idx_marcaciones_empresa_fecha_no_anulada ON marcaciones(empresa_id, marcado_en) WHERE anulada = FALSE;

COMMIT;
