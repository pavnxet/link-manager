-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Links table with auto-incrementing display number
CREATE TABLE IF NOT EXISTS links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  display_number SERIAL UNIQUE NOT NULL,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT -- Telegram user ID
);

-- Bot sessions table for authentication (no JWT)
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  is_authenticated BOOLEAN DEFAULT FALSE,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  telegram_user_id BIGINT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (telegram_user_id, window_start)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_links_url ON links(url);
CREATE INDEX IF NOT EXISTS idx_links_display_number ON links(display_number);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON bot_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(telegram_user_id);

-- Function to clean up old rate limit entries (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;
