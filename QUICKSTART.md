# 🚀 Quick Start Guide - Link Vault Telegram Bot

## Overview
This is a complete Telegram Bot implementation that:
- ✅ Uses **Supabase Anon Key** (NO legacy service role keys)
- ✅ Auto-detects links and asks for confirmation with inline buttons
- ✅ Sequential numbering (#1, #2, #3...)
- ✅ Simple database-based authentication (NO JWT)
- ✅ Runs on Cloudflare Workers

---

## Step 1: Set Up Supabase

### 1.1 Create a Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Wait for it to initialize

### 1.2 Get Your Credentials
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (NOT the service_role key!)

### 1.3 Run the Migration
1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy and paste the content from `/workspace/supabase/migrations/001_bot_setup.sql`
4. Click **Run**

---

## Step 2: Create Telegram Bot

### 2.1 Create Bot with BotFather
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow instructions to name your bot
4. **Save the bot token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2.2 Set Privacy Mode (Important!)
1. In BotFather, send `/mybots`
2. Select your bot
3. Go to **Bot Settings** → **Group Privacy**
4. Set to **Turn off** (so bot can see all messages)

---

## Step 3: Configure Cloudflare Workers

### 3.1 Install Wrangler (if not already installed)
```bash
npm install -g wrangler
```

### 3.2 Login to Cloudflare
```bash
wrangler login
```

### 3.3 Set Secrets
Navigate to the worker directory:
```bash
cd /workspace/worker
```

Set the required secrets:
```bash
# Admin credentials (choose your own)
wrangler secret put ADMIN_USERNAME
# Enter: your_admin_username

wrangler secret put ADMIN_PASSWORD  
# Enter: your_secure_password

# Supabase credentials
wrangler secret put SUPABASE_URL
# Enter: https://your-project.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# Enter: your_anon_key_from_step_1

# Telegram bot token
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter: bot_token_from_botfather
```

### 3.4 Deploy the Worker
```bash
wrangler deploy
```

You'll get a URL like: `https://link-vault-telegram-bot.your-subdomain.workers.dev`

---

## Step 4: Set Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://link-vault-telegram-bot.your-subdomain.workers.dev/webhook"
```

Replace:
- `YOUR_BOT_TOKEN` with your actual bot token
- The worker URL with your deployed worker URL

Verify webhook was set:
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

---

## Step 5: Test Your Bot!

### 5.1 Open Your Bot in Telegram
1. Search for your bot by username
2. Click **Start**

### 5.2 Authenticate
```
/login your_admin_username your_secure_password
```

You should see: `Successfully authenticated!`

### 5.3 Send a Link
Just send any URL like:
```
https://example.com
```

The bot will respond with:
```
🔗 Found a link!

Title: Example Domain
Page: Example Domain
URL: https://example.com

Do you want to save this?

[✅ Save] [❌ Cancel]
```

Click **✅ Save** and it will be saved with an auto-incremented number!

### 5.4 Other Commands
- `/list` - View all saved links
- `/list search_term` - Search links
- `/delete 5` - Delete link #5
- `/backup` - Download all links as JSON
- `/stats` - View statistics
- `/help` - Show help

---

## Security Notes

### Using Anon Key (Not Service Role)
This implementation uses the **Supabase Anon Key** which is safer than the service role key because:
- It respects Row Level Security (RLS)
- Limited permissions by default
- Can be exposed in client-side code safely

### Recommended: Add Row Level Security (RLS)
For production, add RLS policies in Supabase:

```sql
-- Enable RLS
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write links
CREATE POLICY "Authenticated users can view links"
  ON links FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert links"
  ON links FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete links"
  ON links FOR DELETE
  USING (true);
```

---

## Troubleshooting

### Bot doesn't respond
1. Check webhook: `curl https://api.telegram.org/botTOKEN/getWebhookInfo`
2. Check worker logs: `wrangler tail`
3. Verify bot token is correct

### Authentication fails
1. Double-check `ADMIN_USERNAME` and `ADMIN_PASSWORD` secrets
2. Ensure you're typing the command correctly: `/login username password`

### Links not saving
1. Check Supabase connection (URL and anon key)
2. Verify migration was run successfully
3. Check worker logs: `wrangler tail`

---

## Architecture

```
Telegram User
     ↓
Telegram Bot API
     ↓
Cloudflare Workers (webhook)
     ↓
Supabase (PostgreSQL)
```

- **No JWT tokens** - Session stored in database
- **No service role keys** - Uses safer anon key
- **Inline buttons** - Confirm before saving
- **Auto-numbering** - Sequential IDs via SERIAL

---

## File Structure

```
/workspace
├── worker/
│   ├── src/
│   │   ├── index.ts       # Main webhook handler
│   │   ├── supabase.ts    # Database operations
│   │   ├── telegram.ts    # Telegram utilities
│   │   └── env.d.ts       # TypeScript types
│   ├── package.json
│   ├── wrangler.toml
│   └── tsconfig.json
└── supabase/
    └── migrations/
        └── 001_bot_setup.sql
```

---

## Next Steps

1. **Customize** admin credentials
2. **Add categories** if needed
3. **Set up monitoring** with Cloudflare Analytics
4. **Enable RLS** for production security
5. **Share** with your team!

Enjoy your new Telegram-powered Link Vault! 🎉
