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

### 4. Deploy via the Cloudflare dashboard (no CLI)

1. **Push this repo to GitHub** (already done if you're reading this on GitHub).
2. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)** → **Workers & Pages** → **Create** → **Workers** tab → **Import a repository**.
3. Authorize Cloudflare to access your GitHub account, then pick `pavnxet/link-manager` (or your fork) and the branch you want to deploy.
4. On the build configuration screen:
   - **Build command**: leave empty (Wrangler reads `wrangler.toml` directly).
   - **Deploy command**: `npx wrangler deploy` (this is the default).
   - **Root directory**: leave as `/`.
5. Click **Save and Deploy**. Cloudflare will build and publish the Worker — note the assigned URL, e.g. `https://links-telegram-bot.<your-subdomain>.workers.dev`.
6. Open the new Worker → **Settings** → **Variables and Secrets** → **Add** each of these as **Secret** (not plain text):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` (any long random hex — `openssl rand -hex 32`)
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH` (sha256 hex of your password — see step 3 above)
   - `BOT_USERNAME`

   Click **Save and deploy** so the Worker picks them up.
7. **Register the Telegram webhook** by visiting this URL in your browser (replace both placeholders with your real values):
   ```
   https://links-telegram-bot.<your-subdomain>.workers.dev/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
   ```
   You should see `Webhook set to https://…/webhook/<secret>`.
8. Open Telegram, message your bot — `/start`, then `/login admin yourpassword`.

#### Updating later
Push to the branch you connected, and Cloudflare will auto-rebuild and redeploy on every commit. To rotate a secret, edit it under **Settings → Variables and Secrets** and click **Save and deploy**.
