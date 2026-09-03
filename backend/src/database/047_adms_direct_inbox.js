// Recepcion directa en cuarentena; NO habilita importacion automatica a asistencia.
const sql = `
ALTER TABLE biometrico_dispositivos
  ADD COLUMN IF NOT EXISTS recepcion_directa BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ultimo_contacto_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_lote_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_lote_registros INTEGER,
  ADD COLUMN IF NOT EXISTS ultimo_lote_nuevos INTEGER;
ALTER TABLE biometrico_eventos ADD COLUMN IF NOT EXISTS adms_recibido_en TIMESTAMPTZ;
ALTER TABLE biometrico_eventos DROP CONSTRAINT IF EXISTS biometrico_eventos_origen_check;
ALTER TABLE biometrico_eventos ADD CONSTRAINT biometrico_eventos_origen_check
  CHECK (origen IN ('piloto_manual','adms_sin_verificar'));
`;
module.exports = async client => client.query(sql);
module.exports.sql = sql;
