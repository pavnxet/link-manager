-- Schema for the Telegram-bot links manager (Supabase / Postgres).
-- Apply via: psql "$SUPABASE_DB_URL" -f schema.sql   (or paste into the Supabase SQL editor)

-- ---------- links ----------
CREATE TABLE IF NOT EXISTS links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_telegram_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_telegram_id, url)
);

CREATE INDEX IF NOT EXISTS links_owner_idx ON links (owner_telegram_id);
CREATE INDEX IF NOT EXISTS links_owner_created_idx ON links (owner_telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS links_search_idx ON links
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(page_title,'') || ' ' || coalesce(category,'')));

-- ---------- bot_users ----------
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- bot_sessions ----------
-- Stores authenticated sessions (admin login) and ephemeral conversation state.
CREATE TABLE IF NOT EXISTS bot_sessions (
  telegram_id BIGINT PRIMARY KEY,
  token_hash TEXT,                 -- sha256 hex of session token (null = not logged in)
  expires_at TIMESTAMPTZ,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,  -- conversation state: { awaiting: 'import_file' | ... }
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- RLS: deny anon, allow only via secret key ----------
ALTER TABLE links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
-- (No policies = no access for anon/authenticated roles. The Worker uses the
--  Supabase secret API key, which bypasses RLS.)
