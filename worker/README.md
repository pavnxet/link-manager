# Link Vault Telegram Bot

A Telegram bot for saving and managing links with Supabase backend and Cloudflare Workers.

## Features

- 🔗 **Auto-detect URLs**: Send any message with a link, bot will ask to save it
- ✅ **Inline Confirmation**: Click buttons to save or cancel
- 🔐 **Admin Authentication**: Simple username/password login via `/login`
- 📊 **Statistics**: Track total links and users
- 💾 **Backup/Restore**: Export and import all your links
- 🔍 **Search**: Find links by title, URL, or page title
- 🔢 **Sequential Numbering**: Each link gets an auto-incremented number

## Architecture

```
Telegram Bot → Cloudflare Workers → Supabase (PostgreSQL)
```

## Setup Instructions

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the bot token (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the migration:
   ```sql
   -- Copy contents of supabase/migrations/001_bot_setup.sql
   ```
3. Get your credentials:
   - Project URL: `Settings` → `API` → `Project URL`
   - Service Role Key: `Settings` → `API` → `Project API keys` → `service_role`

### 3. Configure Cloudflare Workers

1. Install dependencies:
   ```bash
   cd worker
   npm install
   ```

2. Set up secrets:
   ```bash
   wrangler secret put ADMIN_USERNAME
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   wrangler secret put TELEGRAM_BOT_TOKEN
   ```

3. Deploy the worker:
   ```bash
   npm run deploy
   ```

4. Get your worker URL from the deployment output (e.g., `https://link-vault-bot.your-subdomain.workers.dev`)

### 4. Set Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_URL>/webhook"
```

Replace:
- `<YOUR_BOT_TOKEN>` with your Telegram bot token
- `<YOUR_WORKER_URL>` with your Cloudflare Workers URL

### 5. Test the Bot

1. Open your bot in Telegram
2. Send `/start` to see welcome message
3. Send `/login admin yourpassword` (replace with your credentials)
4. Send any message containing a URL
5. Click "✅ Save" button when prompted

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/login <username> <password>` | Authenticate as admin |
| `/list [query]` | View saved links (optional search) |
| `/delete <number>` | Delete a link by number |
| `/backup` | Export all links as JSON |
| `/restore` | Import links from backup file |
| `/stats` | View statistics |
| `/help` | Show help message |

## Development

Run locally:
```bash
cd worker
npm run dev
```

Use ngrok or similar to expose local server for webhook testing.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Admin username for authentication |
| `ADMIN_PASSWORD` | Admin password for authentication |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from BotFather |

## Security Notes

- Authentication is stored in Supabase database (no JWT)
- Sessions persist until explicitly cleared
- All API calls use Supabase service role (server-side only)
- Rate limiting can be added via Cloudflare Workers KV

## Migration from Web App

To migrate existing data:

1. Export from web app using `/backup` command
2. The backup JSON can be imported via `/restore` command
3. All existing links will maintain their data
