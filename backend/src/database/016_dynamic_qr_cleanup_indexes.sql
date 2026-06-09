DROP INDEX IF EXISTS idx_tokens_dinamicos_token_activo;

CREATE INDEX IF NOT EXISTS idx_tokens_dinamicos_token_expira
  ON sucursal_tokens_dinamicos(token, expira_en);

DELETE FROM sucursal_tokens_dinamicos
WHERE expira_en <= NOW() - INTERVAL '1 day';
