# Link Manager (Telegram + Cloudflare Worker + Supabase)

Telegram-first link manager powered by Cloudflare Worker and Supabase.

## Kept files/scope

This repository now keeps only Telegram-worker related implementation:
- `worker/` (webhook backend, command router, tests, wrangler config)
- `schema.sql` (Supabase schema + RPC)
- root docs/config (`README.md`, `.env.local.example`, `package.json`, `.gitignore`)

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_TTL_SECONDS` (optional, default `86400`)
- `RATE_LIMIT_PER_MINUTE` (optional, default `30`)

## Setup

1. Run `schema.sql` in Supabase SQL editor.
2. Create KV namespaces and set IDs in `worker/wrangler.toml` (`SESSIONS`, `RATE_LIMIT`).
3. Install dependencies:
   ```bash
   npm install
   cd worker && npm install
   ```
4. Set Worker secrets:
   ```bash
   cd worker
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   npx wrangler secret put ADMIN_USERNAME
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
5. Deploy Worker:
   ```bash
   npm run build
   npx wrangler deploy
   ```
6. Register webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://<your-worker-domain>/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
   ```

## Commands

- `/login <username> <password>`
- `/nextid`
- `/add <url> [title] [category=#Tag]`
- `/list [query]`
- `/search <query>`
- `/edit <id> title=<...> page_title=<...> category=<...> url=<...>`
- `/delete <id>` then `/confirm <token>`
- `/backup`
- `/restore` (upload JSON backup)
- `/scrape <url>`
- `/help`

## Validation

From repository root:

```bash
npm run lint
npm test
npm run build
```
