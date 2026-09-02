// Migracion del ejecutor propio de AsistePro (no usa historial de Supabase CLI).
const sql = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_integraciones_empresa_id_id ON integraciones_externas(empresa_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sucursales_empresa_id_id ON sucursales(empresa_id,id);
CREATE TABLE IF NOT EXISTS biometrico_dispositivos (
  integracion_id UUID PRIMARY KEY,
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  serial VARCHAR(40) NOT NULL UNIQUE CHECK (serial ~ '^[A-Za-z0-9_-]{1,40}$'),
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id,integracion_id),
  FOREIGN KEY (empresa_id,integracion_id) REFERENCES integraciones_externas(empresa_id,id),
  FOREIGN KEY (empresa_id,sucursal_id) REFERENCES sucursales(empresa_id,id)
);
CREATE INDEX IF NOT EXISTS idx_biometrico_dispositivos_sucursal ON biometrico_dispositivos(empresa_id,sucursal_id);
CREATE TABLE IF NOT EXISTS biometrico_eventos (
  empresa_id UUID NOT NULL,
  integracion_id UUID NOT NULL,
  referencia VARCHAR(64) NOT NULL CHECK (referencia ~ '^[a-f0-9]{64}$'),
  dispositivo_usuario_id VARCHAR(24) NOT NULL CHECK (dispositivo_usuario_id ~ '^[A-Za-z0-9_-]{1,24}$'),
  fecha_hora_local TIMESTAMP NOT NULL,
  estado_dispositivo SMALLINT NOT NULL CHECK (estado_dispositivo BETWEEN 0 AND 999),
  verificacion SMALLINT NOT NULL CHECK (verificacion BETWEEN 0 AND 999),
  origen VARCHAR(30) NOT NULL CHECK (origen = 'piloto_manual'),
  recibido_por UUID REFERENCES usuarios(id),
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (integracion_id,referencia),
  FOREIGN KEY (empresa_id,integracion_id) REFERENCES biometrico_dispositivos(empresa_id,integracion_id)
);
CREATE INDEX IF NOT EXISTS idx_biometrico_eventos_fecha ON biometrico_eventos(empresa_id,integracion_id,fecha_hora_local DESC,referencia);
ALTER TABLE biometrico_dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometrico_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON biometrico_dispositivos,biometrico_eventos FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON biometrico_dispositivos,biometrico_eventos FROM anon;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON biometrico_dispositivos,biometrico_eventos FROM authenticated;
  END IF;
END $roles$;
`;

async function migrate(client) { await client.query(sql); }
module.exports = migrate;
module.exports.sql = sql;
