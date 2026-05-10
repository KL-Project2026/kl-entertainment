-- 006_password_reset_tokens.sql
-- Adds password-reset token columns to staff, customers, shareholders.
-- Token is a SHA-256 hex digest of the raw secret (raw secret is only emailed).

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS reset_token_hash      TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reset_token_hash      TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

ALTER TABLE shareholders
  ADD COLUMN IF NOT EXISTS reset_token_hash      TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_reset_token_hash       ON staff       (reset_token_hash)       WHERE reset_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_reset_token_hash   ON customers   (reset_token_hash)       WHERE reset_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shareholders_reset_token_hash ON shareholders (reset_token_hash)      WHERE reset_token_hash IS NOT NULL;
