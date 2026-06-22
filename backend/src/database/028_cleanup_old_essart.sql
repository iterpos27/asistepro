BEGIN;

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  -- 1. Find the company ID for 'ESSART S.A' (without the trailing dot)
  SELECT id INTO v_company_id FROM empresas WHERE nombre = 'ESSART S.A' LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    -- 2. Delete the company (cascades to sucursales, empleados, suscripciones, etc.)
    DELETE FROM empresas WHERE id = v_company_id;

    -- 3. Delete all users linked to that company
    DELETE FROM usuarios WHERE empresa_id = v_company_id;
  END IF;

  -- 4. Delete the user 'juan.duenas@essart.com.ec' specifically (in case they are not linked to that company ID)
  DELETE FROM usuarios WHERE email = 'juan.duenas@essart.com.ec';
END $$;

COMMIT;
