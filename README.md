# Links Telegram Bot

A Telegram bot to save, search, and share links. Backed by **Supabase** (Postgres) and served by a **Cloudflare Worker**.

## Architecture
```
Telegram ──webhook──▶ Cloudflare Worker (worker/) ──REST──▶ Supabase
```
- Worker uses Supabase's new key model: `sb_publishable_…` + `sb_secret_…` (no legacy anon/service_role).
- Single-admin auth via `/login <user> <pass>` — password stored as a sha256 hash in Worker secrets.
- Webhook URL contains a secret + Telegram's `X-Telegram-Bot-Api-Secret-Token` header is verified.
- RLS is enabled on every table; the Worker is the only client and uses the secret key.

## Bot features
- `/start`, `/help`
- `/login`, `/logout`, `/whoami`
- `/add <url> [title]` — also auto-fetches the page `<title>`
- `/list [page]` — paginated with inline Prev/Next
- `/search <query>`
- `/get <id>`, `/delete <id>`, `/category <id> <name>`
- `/stats`
- `/export` — sends a JSON file
- `/import` — upload a JSON file
- Inline mode: `@yourbot query` to search and share
- Inline keyboard with delete confirmation
- In-memory token-bucket rate limit per user

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. SQL editor → paste `schema.sql` → Run.
3. Project Settings → API keys → use the **new** Publishable (`sb_publishable_…`) and Secret (`sb_secret_…`) keys.

### 2. Telegram bot
1. Talk to [@BotFather](https://t.me/BotFather) → `/newbot` → save the token.
2. `/setinline` to enable inline mode.

### 3. Local dev on Replit
1. Copy `.dev.vars.example` → `.dev.vars` and fill it in.
2. Hash your admin password:
   ```
   node scripts/hash-password.mjs 'your password'
   ```
   Put the hex into `ADMIN_PASSWORD_HASH`.
3. Generate a webhook secret (any long random hex):
   ```
   openssl rand -hex 32
   ```
4. The workflow runs `wrangler dev` on port 5000 — Replit exposes it as `https://<your-repl>.replit.dev`.
5. Register the webhook:
   ```
   WORKER_URL=https://<your-repl>.replit.dev WEBHOOK_SECRET=<same as .dev.vars> npm run set-webhook
   ```
6. Message the bot — `/start`, then `/login admin yourpassword`.

### 4. Deploy
```
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put BOT_USERNAME
npm run deploy
WORKER_URL=https://links-telegram-bot.<acct>.workers.dev WEBHOOK_SECRET=... npm run set-webhook
```
