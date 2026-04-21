# Link Vault Telegram Bot Implementation Plan

## Project Transformation Overview
Convert Next.js web app to Telegram Bot with:
- **Backend**: Supabase (PostgreSQL) for data persistence
- **Bridge**: Cloudflare Workers as API layer  
- **Interface**: Telegram Bot commands + Inline Buttons
- **Authentication**: Admin username/password (No JWT, DB-based sessions)

## Architecture
```
Telegram Bot → Cloudflare Workers → Supabase (PostgreSQL)
```

## Phase 1: Project Setup
- New structure with `worker/`, `supabase/` directories
- Dependencies: `hono`, `@supabase/supabase-js`, `wrangler`, `node-telegram-bot-api` (for local testing)

## Phase 2: Supabase Schema
```sql
-- Links table
CREATE TABLE links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  page_title TEXT,
  url TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot sessions table  
CREATE TABLE bot_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  is_authenticated BOOLEAN DEFAULT FALSE,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  request_count INTEGER DEFAULT 0
);

-- Pending links table (for confirmation flow)
CREATE TABLE pending_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  page_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Phase 3: Cloudflare Workers
- **Main handler**: Webhook processing from Telegram
- **Telegram module**: Command routing + Inline button handling
- **Supabase module**: Database operations
- **Auth module**: Simple DB-based session verification

## Phase 4: Telegram Commands & Flows

### Authentication
- `/login <username> <password>` - Authenticate admin user
- `/logout` - Clear session

### Link Management
- **Auto-detect URLs**: When user sends any message containing a URL:
  1. Bot extracts URL and fetches page title
  2. Shows inline keyboard: "Save this link?" with [✅ OK] [❌ Cancel] buttons
  3. On ✅ OK: Saves to database with auto-generated sequential number
  4. On ❌ Cancel: Discards the link
  
- `/list [query]` - Search and display links (paginated)
- `/delete <id>` - Remove specific link
- `/categories` - Show all categories

### Data Management
- `/backup` - Export all links as JSON file
- `/restore` - Import links from uploaded JSON file
- `/stats` - Show total links, categories count

### Help
- `/help` - Show all available commands
- `/start` - Welcome message with quick start guide

## Phase 5: Security & Authentication (No JWT)
- **Simple Session Storage**: Store authenticated user IDs in Supabase `bot_sessions` table
- **Login Flow**: `/login <username> <password>` → Verify against env vars → Store telegram_user_id as authenticated
- **Session Persistence**: Auth status stored in DB, checked on each command
- **Rate Limiting**: Track request timestamps in DB (10 requests/min/user)
- **Environment Secrets**: Admin credentials stored in Cloudflare Workers secrets

## Phase 6: User Experience Flow

### Sending a Link
1. User sends: `https://example.com/article`
2. Bot responds: 
   ```
   📎 Found Link:
   Title: Example Article
   URL: https://example.com/article
   
   Save to vault?
   ```
   [✅ Save] [❌ Cancel]

3. User clicks [✅ Save]
4. Bot saves and responds:
   ```
   ✅ Saved as #127
   Category: uncategorized
   Use /list to view all links
   ```

### Login Flow
1. User sends: `/admin myusername mypassword`
2. Bot verifies credentials
3. If valid: "✅ Authenticated! You can now save links."
4. If invalid: "❌ Invalid credentials"

## Phase 7: Deployment Steps
1. Create Telegram bot via BotFather, get token
2. Set up Supabase project, run schema migrations
3. Configure Cloudflare Workers with secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
4. Deploy worker to Cloudflare
5. Set webhook: `https://<worker-url>/webhook`
6. Test all flows

## Migration Strategy
- Export current Next.js app data to JSON
- Use `/restore` command to import into new bot
- Maintain all existing link metadata

## Success Criteria
- All web features replicated in Telegram bot
- Inline button confirmation for every link save
- No JWT tokens, simple DB-based auth
- Sub-2 second response times
- Secure admin authentication
- Successful data migration
