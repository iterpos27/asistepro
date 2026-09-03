// Migracion del ejecutor propio de AsistePro. Los pendientes NO son asistencia.
const sql = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_empresa_id_id ON empleados(empresa_id,id);
ALTER TABLE biometrico_eventos ADD COLUMN IF NOT EXISTS sincronizado_empleado_id UUID;
ALTER TABLE biometrico_eventos ADD COLUMN IF NOT EXISTS sincronizado_en TIMESTAMPTZ;
ALTER TABLE biometrico_eventos ADD COLUMN IF NOT EXISTS sincronizado_por UUID REFERENCES usuarios(id);
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='biometrico_eventos'::regclass
    AND conname='biometrico_eventos_empleado_empresa_fk') THEN
    ALTER TABLE biometrico_eventos ADD CONSTRAINT biometrico_eventos_empleado_empresa_fk
      FOREIGN KEY (empresa_id,sincronizado_empleado_id) REFERENCES empleados(empresa_id,id);
  END IF;
END $constraints$;
CREATE INDEX IF NOT EXISTS idx_biometrico_eventos_sincronizados
  ON biometrico_eventos(empresa_id,sincronizado_empleado_id,fecha_hora_local DESC)
  WHERE sincronizado_empleado_id IS NOT NULL;
`;
async function migrate(client) { await client.query(sql); }
module.exports = migrate;
module.exports.sql = sql;
