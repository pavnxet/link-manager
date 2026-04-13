-- Create the links table for SQLite/Turso
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster search (SQLite doesn't have GIN or full-text natively without FTS5, so regular indices)
CREATE INDEX IF NOT EXISTS links_title_idx ON links(title);
CREATE INDEX IF NOT EXISTS links_page_title_idx ON links(page_title);
CREATE INDEX IF NOT EXISTS links_url_idx ON links(url);
