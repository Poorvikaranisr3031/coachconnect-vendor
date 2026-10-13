CREATE TABLE IF NOT EXISTS passenger_password_credentials (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS passenger_password_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passenger_password_sessions_expiry_idx ON passenger_password_sessions(expires_at);
CREATE INDEX IF NOT EXISTS passenger_password_sessions_user_idx ON passenger_password_sessions(user_id);
CREATE TABLE IF NOT EXISTS passenger_password_login_attempts (
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passenger_password_login_attempts_email_idx ON passenger_password_login_attempts(email, attempted_at);