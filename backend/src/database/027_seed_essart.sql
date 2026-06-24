BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_user_employee(
  p_company_id UUID,
  p_rol_id UUID,
  p_branch_id UUID,
  p_email VARCHAR,
  p_nombres VARCHAR,
  p_apellidos VARCHAR,
  p_code VARCHAR,
  p_pwd_hash VARCHAR
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM usuarios WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    INSERT INTO usuarios (empresa_id, rol_id, nombre, apellido, email, password_hash, estado)
    VALUES (p_company_id, p_rol_id, p_nombres, p_apellidos, p_email, p_pwd_hash, 'activo')
    RETURNING id INTO v_user_id;
  END IF;

  -- Check if employee already exists
  IF NOT EXISTS (SELECT 1 FROM empleados WHERE empresa_id = p_company_id AND email = p_email) THEN
    INSERT INTO empleados (empresa_id, usuario_id, sucursal_habitual_id, codigo, nombres, apellidos, email, estado)
    VALUES (p_company_id, v_user_id, p_branch_id, p_code, p_nombres, p_apellidos, p_email, 'activo');
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_company_id UUID;
  v_plan_id UUID;
  v_rol_empleado_id UUID;
  v_rol_rrhh_id UUID;
  v_rol_admin_id UUID;
  v_branch_matriz_id UUID;
  v_branch_pv01_id UUID;
  v_branch_pv02_id UUID;
  v_branch_pv03_id UUID;
  v_branch_manta01_id UUID;
  v_branch_manta02_id UUID;
  v_branch_guayaquil01_id UUID;
  v_branch_chone01_id UUID;
  v_pwd_hash TEXT := '$2b$10$yKzUYMQadMg1p1cxdg7s6uqd.E3Yo.KIHux69TpyIEs3bN.aNoSQu';
BEGIN
  -- 1. Get plan ID
  SELECT id INTO v_plan_id FROM planes WHERE codigo = 'enterprise';
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan enterprise no encontrado';
  END IF;

  -- 2. Insert or get company ESSART S.A.
  SELECT id INTO v_company_id FROM empresas WHERE UPPER(nombre) = 'ESSART S.A.' LIMIT 1;
  IF v_company_id IS NULL THEN
    INSERT INTO empresas (nombre, plan_id, estado)
    VALUES ('ESSART S.A.', v_plan_id, 'activa')
    RETURNING id INTO v_company_id;

    -- Create Subscription
    INSERT INTO suscripciones (empresa_id, plan_id, estado, fecha_inicio, fecha_fin, monto_mensual)
    VALUES (v_company_id, v_plan_id, 'activa', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 0);
  END IF;

  -- Get roles
  SELECT id INTO v_rol_empleado_id FROM roles WHERE codigo = 'EMPLEADO';
  SELECT id INTO v_rol_rrhh_id FROM roles WHERE codigo = 'RRHH';
  SELECT id INTO v_rol_admin_id FROM roles WHERE codigo = 'ADMIN_EMPRESA';

  -- 3. Create Branches
  -- Matriz
  SELECT id INTO v_branch_matriz_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'MATRIZ' LIMIT 1;
  IF v_branch_matriz_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'MATRIZ', 'MATRIZ', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_matriz_id;
  END IF;

  -- Portoviejo 01
  SELECT id INTO v_branch_pv01_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'PORTOVIEJO01' LIMIT 1;
  IF v_branch_pv01_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'PORTOVIEJO 01', 'PORTOVIEJO01', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_pv01_id;
  END IF;

  -- Portoviejo 02
  SELECT id INTO v_branch_pv02_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'PORTOVIEJO02' LIMIT 1;
  IF v_branch_pv02_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'PORTOVIEJO 02', 'PORTOVIEJO02', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_pv02_id;
  END IF;

  -- Portoviejo 03
  SELECT id INTO v_branch_pv03_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'PORTOVIEJO03' LIMIT 1;
  IF v_branch_pv03_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'PORTOVIEJO 03', 'PORTOVIEJO03', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_pv03_id;
  END IF;

  -- Manta 01
  SELECT id INTO v_branch_manta01_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'MANTA01' LIMIT 1;
  IF v_branch_manta01_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'MANTA 01', 'MANTA01', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_manta01_id;
  END IF;

  -- Manta 02
  SELECT id INTO v_branch_manta02_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'MANTA02' LIMIT 1;
  IF v_branch_manta02_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'MANTA 02', 'MANTA02', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_manta02_id;
  END IF;

  -- Guayaquil 01
  SELECT id INTO v_branch_guayaquil01_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'GUAYAQUIL01' LIMIT 1;
  IF v_branch_guayaquil01_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'GUAYAQUIL 01', 'GUAYAQUIL01', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_guayaquil01_id;
  END IF;

  -- Chone 01
  SELECT id INTO v_branch_chone01_id FROM sucursales WHERE empresa_id = v_company_id AND codigo = 'CHONE01' LIMIT 1;
  IF v_branch_chone01_id IS NULL THEN
    INSERT INTO sucursales (empresa_id, nombre, codigo, latitud, longitud, radio_metros, qr_token, estado)
    VALUES (v_company_id, 'CHONE 01', 'CHONE01', 0, 0, 100, encode(gen_random_bytes(32), 'hex'), 'activa')
    RETURNING id INTO v_branch_chone01_id;
  END IF;

  -- 4. Seed users and employees
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_matriz_id, 'amin.alarcon@essart.com.ec', 'Amin', 'Alarcon', 'AMIN_ALARCON', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_admin_id, v_branch_matriz_id, 'juan.duenas@essart.com.ec', 'Juan', 'Dueñas', 'JUAN_DUEÑAS', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_rrhh_id, v_branch_matriz_id, 'gianella.herrera@essart.com.ec', 'Gianella', 'Herrera', 'GIANELLA_HERRERA', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_pv01_id, 'ramiro.muentes@essart.com.ec', 'Ramiro', 'Muentes', 'RAMIRO_MUENTES', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_pv02_id, 'ariel.valdiviezo@essart.com.ec', 'Ariel', 'Valdiviezo', 'ARIEL_VALDIVIEZO', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_pv02_id, 'alberto.chinga@essart.com.ec', 'Alberto', 'Chinga', 'ALBERTO_CHINGA', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_pv03_id, 'johan.garcia@essart.com.ec', 'Johan', 'Garcia', 'JOHAN_GARCIA', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_pv03_id, 'jonathan.roldan@essart.com.ec', 'Jonathan', 'Roldan', 'JONATHAN_ROLDAN', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_manta01_id, 'italo.alvarez@essart.com.ec', 'Italo', 'Alvarez', 'ITALO_ALVAREZ', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_manta01_id, 'dexi.zambrano@essart.com.ec', 'Dexi', 'Zambrano', 'DEXI_ZAMBRANO', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_manta02_id, 'laura.macias@essart.com.ec', 'Laura', 'Macias', 'LAURA_MACIAS', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_guayaquil01_id, 'kevin.choez@essart.com.ec', 'Kevin', 'Choez', 'KEVIN_CHOEZ', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_guayaquil01_id, 'luis.romero@essart.com.ec', 'Luis', 'Romero', 'LUIS_ROMERO', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_chone01_id, 'pablo.vargas@essart.com.ec', 'Pablo', 'Vargas', 'PABLO_VARGAS', v_pwd_hash);
  PERFORM pg_temp.seed_user_employee(v_company_id, v_rol_empleado_id, v_branch_chone01_id, 'ruben.zambrano@essart.com.ec', 'Ruben', 'Zambrano', 'RUBEN_ZAMBRANO', v_pwd_hash);
END $$;

COMMIT;
