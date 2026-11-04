-- Link Vault — Supabase / PostgreSQL schema
CREATE TABLE IF NOT EXISTS links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security.
--
-- The app talks to Postgres from the server with the SERVICE ROLE key, which bypasses RLS. Enabling
-- it with no policies means the public anon key (a NEXT_PUBLIC_ value, i.e. shipped to the browser)
-- can read nothing at all. Leaving it disabled — which this file used to do — meant anyone holding
-- that key could read the whole vault.
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- Search indexes.
--
-- The routes search with ILIKE '%term%', which a to_tsvector GIN index cannot serve, so the old
-- indexes were never used. Trigram indexes do serve it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS links_title_trgm_idx ON links USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS links_page_title_trgm_idx ON links USING GIN (page_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS links_category_trgm_idx ON links USING GIN (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS links_url_idx ON links (url);
CREATE INDEX IF NOT EXISTS links_created_at_idx ON links (created_at DESC);

-- Highest numeric title, used for the "next id" suggestion.
-- TRIM + a whitespace-tolerant pattern, so padded titles ('007', ' 42 ') are counted instead of
-- being skipped and handing out numbers that already exist.
CREATE OR REPLACE FUNCTION get_max_numeric_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(TRIM(title)::INTEGER)
     FROM links
     WHERE TRIM(title) ~ '^[0-9]+$'),
    0
  );
END;
$$ LANGUAGE plpgsql;
