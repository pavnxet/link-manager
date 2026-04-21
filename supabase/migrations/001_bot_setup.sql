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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_number BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT links_user_url_unique UNIQUE (user_id, url),
  CONSTRAINT links_user_display_number_unique UNIQUE (user_id, display_number)
);

-- Rate limiting table expected by worker runtime
CREATE TABLE IF NOT EXISTS rate_limits (
  telegram_user_id BIGINT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_telegram_user_id ON links(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_links_display_number ON links(display_number);
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

-- Assign per-user sequential display_number
CREATE OR REPLACE FUNCTION assign_links_display_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_number IS NULL OR NEW.display_number <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
    SELECT COALESCE(MAX(display_number), 0) + 1
    INTO NEW.display_number
    FROM links
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_links_updated_at ON links;
CREATE TRIGGER trg_links_updated_at
BEFORE UPDATE ON links
FOR EACH ROW
EXECUTE FUNCTION set_links_updated_at();

DROP TRIGGER IF EXISTS trg_links_display_number ON links;
CREATE TRIGGER trg_links_display_number
BEFORE INSERT ON links
FOR EACH ROW
EXECUTE FUNCTION assign_links_display_number();

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
  INSERT INTO rate_limits (telegram_user_id, count, window_start)
  VALUES (p_telegram_user_id, 1, NOW())
  ON CONFLICT (telegram_user_id) DO UPDATE
  SET
    count = CASE
      WHEN rate_limits.window_start < p_window_start THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < p_window_start THEN NOW()
      ELSE rate_limits.window_start
    END;
END;
$$ LANGUAGE plpgsql;
