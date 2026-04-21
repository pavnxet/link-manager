# Links Telegram Bot

A Telegram bot for saving, searching, and sharing links — backed by Supabase, served by a Cloudflare Worker.

## Architecture
- **Cloudflare Worker** (`worker/`) hosts the bot webhook + Supabase REST client.
- **Supabase** (Postgres) is the data layer; accessed only by the Worker via the **new** secret API key (`sb_secret_…`). RLS denies anon access on every table.
- **Telegram Bot API** is reached via webhook; URL contains a secret and the `X-Telegram-Bot-Api-Secret-Token` header is verified.
- Single-admin auth: `/login <user> <pass>` — password stored as sha256 hash in Worker secrets, sessions in `bot_sessions`.

## Files
- `worker/index.ts` — fetch handler, webhook + setup endpoints, rate-limit gate
- `worker/bot.ts` — command/callback/inline dispatch + business logic
- `worker/supabase.ts` — typed PostgREST wrapper using the secret key
- `worker/telegram.ts` — Telegram Bot API client (sendMessage, inline, files, …)
- `worker/scrape.ts` — best-effort `<title>` fetch for /add
- `worker/ratelimit.ts` — in-memory token bucket per Telegram user
- `worker/crypto.ts` — sha256, random tokens, constant-time compare
- `wrangler.toml`, `tsconfig.json`, `schema.sql`
- `scripts/hash-password.mjs`, `scripts/set-webhook.mjs`, `scripts/delete-webhook.mjs`
- `.dev.vars` (local secrets — gitignored), `.dev.vars.example`

## Bot features
Commands: `/start /help /login /logout /whoami /add /list /search /get /delete /category /stats /export /import /cancel`. Inline mode (`@bot query`) returns shareable article results. Inline-keyboard pagination + delete confirmation.

## Replit dev
- Workflow `Start application` runs `wrangler dev --port 5000 --ip 0.0.0.0`.
- Replit exposes the worker as `https://<repl>.replit.dev`. Register the Telegram webhook via `npm run set-webhook` (needs `WORKER_URL` and `WEBHOOK_SECRET`).

## Required secrets (Replit Secrets / `.dev.vars`)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `BOT_USERNAME`.

## Deploy
`npx wrangler login && npx wrangler deploy`, then push the same secrets via `wrangler secret put …` and call `/setup?secret=…` once on the deployed URL.
