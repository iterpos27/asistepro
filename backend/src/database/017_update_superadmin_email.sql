-- Migration to update the superadmin email to iter27pos@gmail.com

BEGIN;

-- 1. Drop the old constraint checking for superadmin@asistepro.local
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_empresa_requerida_check;

-- 2. Update the superadmin user's email to the new address
UPDATE usuarios 
SET email = 'iter27pos@gmail.com',
    actualizado_en = NOW()
WHERE email = 'superadmin@asistepro.local';

-- 3. Re-create the constraint checking for the new superadmin email
ALTER TABLE usuarios 
ADD CONSTRAINT usuarios_empresa_requerida_check 
CHECK (empresa_id IS NOT NULL OR email = 'iter27pos@gmail.com');

COMMIT;
