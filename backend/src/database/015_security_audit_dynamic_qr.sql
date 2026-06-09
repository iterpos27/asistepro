CREATE TABLE IF NOT EXISTS sucursal_tokens_dinamicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tokens_dinamicos_sucursal_expira
  ON sucursal_tokens_dinamicos(sucursal_id, expira_en);

CREATE INDEX IF NOT EXISTS idx_tokens_dinamicos_token_activo
  ON sucursal_tokens_dinamicos(token)
  WHERE usado_en IS NULL;

CREATE TABLE IF NOT EXISTS logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  accion VARCHAR(80) NOT NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id UUID,
  metodo VARCHAR(12),
  ruta TEXT,
  ip INET,
  user_agent TEXT,
  estado_http INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_empresa_fecha
  ON logs_auditoria(empresa_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_entidad
  ON logs_auditoria(entidad, entidad_id);
