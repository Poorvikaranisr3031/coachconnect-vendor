CREATE TABLE IF NOT EXISTS passenger_password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passenger_password_reset_expiry_idx ON passenger_password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS passenger_password_reset_user_idx ON passenger_password_reset_tokens(user_id);