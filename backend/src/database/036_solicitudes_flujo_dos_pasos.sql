BEGIN;

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;

ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check CHECK (estado IN ('pendiente', 'validada', 'aprobada', 'rechazada', 'cancelada'));

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS comentario_validacion TEXT,
  ADD COLUMN IF NOT EXISTS reemplazo_empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL;

COMMIT;
