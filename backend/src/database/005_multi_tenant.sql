BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_identificacion_fiscal_unique
ON empresas(identificacion_fiscal)
WHERE identificacion_fiscal IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suscripciones_empresa_activa_unique
ON suscripciones(empresa_id)
WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_empresas_estado ON empresas(estado);

COMMIT;
