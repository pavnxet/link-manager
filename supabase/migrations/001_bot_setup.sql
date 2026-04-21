-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Canonical user table (single-admin friendly, multi-user ready)
CREATE TABLE IF NOT EXISTS bot_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure one default user exists for current single-admin flow
INSERT INTO bot_users (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM bot_users);

-- Bot sessions table for authentication
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Links table expected by worker runtime
CREATE TABLE IF NOT EXISTS links (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT links_user_url_unique UNIQUE (user_id, url)
);

-- Rate limiting table expected by worker runtime
CREATE TABLE IF NOT EXISTS rate_limits (
  telegram_user_id BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_user_id, window_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_telegram_user_id ON links(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON bot_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(telegram_user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_links_updated_at ON links;
CREATE TRIGGER trg_links_updated_at
BEFORE UPDATE ON links
FOR EACH ROW
EXECUTE FUNCTION set_links_updated_at();

-- Cleanup old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- Atomic rate-limit increment expected by worker runtime
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_telegram_user_id BIGINT,
  p_window_start TIMESTAMPTZ
)
RETURNS void AS $$
BEGIN
  UPDATE rate_limits
  SET count = count + 1
  WHERE telegram_user_id = p_telegram_user_id
    AND window_start >= p_window_start;

  IF NOT FOUND THEN
    INSERT INTO rate_limits (telegram_user_id, count, window_start)
    VALUES (p_telegram_user_id, 1, NOW())
    ON CONFLICT (telegram_user_id, window_start) DO UPDATE
      SET count = rate_limits.count + 1;
  END IF;
END;
$$ LANGUAGE plpgsql;
