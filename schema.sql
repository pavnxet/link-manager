-- Create the links table
CREATE TABLE IF NOT EXISTS links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) is recommended, but for a single user app with strict backend control, it might be overkill if we just use the service role key or handle auth in middleware.
-- However, since we are using Supabase client, we should probably enable RLS if we were using client-side calls. But we are doing server-side calls mostly.
-- Let's just create the table for now.

-- Index for faster search
CREATE INDEX IF NOT EXISTS links_title_idx ON links USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS links_page_title_idx ON links USING GIN (to_tsvector('english', page_title));
CREATE INDEX IF NOT EXISTS links_url_idx ON links (url);
