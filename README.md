# Link Manager (Telegram Bot + Cloudflare Worker + Supabase)

This project now runs as a Telegram-first link manager.

## Architecture

- **Data store:** Supabase (PostgreSQL)
- **Backend bridge:** Cloudflare Worker
- **Client UI:** Telegram bot commands (admin-authenticated)
- **Web app:** retired dashboard; root app only exposes a health/status surface

## Required environment/secrets

### Supabase
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Telegram/Worker
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_TTL_SECONDS` (optional, default `86400`)
- `RATE_LIMIT_PER_MINUTE` (optional, default `30`)

## Database setup

Run `/home/runner/work/link-manager/link-manager/schema.sql` in Supabase SQL editor.

## Worker setup

1. Install worker dependencies:
   ```bash
   cd /home/runner/work/link-manager/link-manager/worker
   npm install
   ```
2. Create KV namespaces and set IDs in `/home/runner/work/link-manager/link-manager/worker/wrangler.toml`:
   - `SESSIONS`
   - `RATE_LIMIT`
3. Set secrets:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   npx wrangler secret put ADMIN_USERNAME
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
4. Deploy:
   ```bash
   npm run build
   npx wrangler deploy
   ```
5. Register Telegram webhook (replace URL):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://<your-worker-domain>/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
   ```

## Bot commands

- `/login <username> <password>`
- `/nextid`
- `/add <url> [title] [category=#Tag]`
- `/list [query]`
- `/search <query>`
- `/edit <id> title=<...> page_title=<...> category=<...> url=<...>`
- `/delete <id>` then `/confirm <token>`
- `/backup`
- `/restore` (then upload backup JSON file)
- `/scrape <url>`
- `/help`

## Security controls included

- Webhook secret verification (`x-telegram-bot-api-secret-token`)
- Admin username/password login
- Session TTL in KV
- Authorized admin chat lock
- Basic per-chat rate limit
- Confirmation token for destructive delete

## Validation commands

From repository root:

```bash
npm run lint
npm test
npm run build
```

From worker directory:

```bash
npm run test
npm run build
```
