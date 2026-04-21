# Link Vault Telegram Bot

> A secure, serverless Telegram bot for saving, organizing, and retrieving your favorite links using Cloudflare Workers and Supabase.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Commands](#commands)
- [Database](#database)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

## Features

- **🔗 Smart Link Detection**: Automatically detects URLs in any message and prompts to save with inline buttons
- **✅ Inline Confirmation**: One-click save/cancel workflow with page title preview
- **🔐 Secure Authentication**: Admin-only access with username/password verification
- **📊 Sequential Numbering**: Auto-incremented IDs (#1, #2, #3...) for easy reference
- **🔍 Search & Filter**: Find saved links by keyword or category
- **💾 Backup & Restore**: Export/import your entire link collection as JSON
- **📈 Statistics**: View usage stats and link counts
- **⚡ Serverless Architecture**: Runs on Cloudflare Workers with zero cold starts
- **🛡️ Row-Level Security**: Database-level access control with Supabase RLS
- **🌐 SSRF Protection**: Built-in protection against server-side request forgery attacks

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Cloudflare Workers (V8 Isolates) |
| **Language** | TypeScript 5.3+ |
| **Framework** | Hono (Ultra-lightweight web framework) |
| **Database** | Supabase (PostgreSQL) |
| **Bot Platform** | Telegram Bot API |
| **HTTP Client** | Native `fetch` API |
| **HTML Parsing** | `node-html-parser` |
| **Deployment** | Wrangler CLI |
| **Package Manager** | npm/pnpm |

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Telegram  │      │  Cloudflare      │      │    Supabase     │
│     Bot     │─────▶│    Workers       │─────▶│   (PostgreSQL)  │
│  (User UI)  │      │  (API Bridge)    │      │   (Data Store)  │
└─────────────┘      └──────────────────┘      └──────────────────┘
       │                       │                       │
       │ 1. Send Link          │                       │
       │──────────────────────▶│                       │
       │                       │ 2. Fetch Page Title   │
       │                       │──────────────────────▶│
       │                       │ 3. Return HTML        │
       │                       │◀──────────────────────│
       │                       │                       │
       │ 4. Show Preview       │                       │
       │◀──────────────────────│                       │
       │                       │                       │
       │ 5. Click "Save"       │                       │
       │──────────────────────▶│                       │
       │                       │ 6. Insert Link        │
       │                       │──────────────────────▶│
       │                       │ 7. Confirm Saved      │
       │                       │◀──────────────────────│
       │ 8. Success Message    │                       │
       │◀──────────────────────│                       │
```

**Flow Description:**
1. User sends a URL to the bot
2. Worker fetches the page metadata (title, description)
3. Bot displays an inline keyboard with Save/Cancel options
4. On confirmation, the link is stored in Supabase with RLS policies
5. All operations are authenticated and rate-limited

## Folder Structure

```text
link-vault-bot/
├── worker/                 # Cloudflare Workers application
│   ├── src/
│   │   ├── index.ts        # Main entry point & webhook handler
│   │   ├── supabase.ts     # Database client & operations
│   │   ├── telegram.ts     # Telegram API utilities & keyboards
│   │   └── env.d.ts        # TypeScript environment definitions
│   ├── package.json        # Dependencies
│   ├── wrangler.toml       # Cloudflare configuration
│   ├── tsconfig.json       # TypeScript configuration
│   └── README.md           # Worker-specific docs
├── supabase/
│   └── migrations/
│       └── 001_bot_setup.sql   # Database schema & RLS policies
├── QUICKSTART.md           # Quick deployment guide
├── IMPLEMENTATION_SUMMARY.md   # Feature overview
└── README.md               # This file
```

## Installation

### Prerequisites

- Node.js 18+ installed
- A [Telegram Bot Token](https://core.telegram.org/bots/features#botfather) from @BotFather
- A [Supabase Project](https://supabase.com/) (free tier works)
- A [Cloudflare Account](https://dash.cloudflare.com/sign-up) (free tier works)

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd link-vault-bot
   ```

2. **Install dependencies**
   ```bash
   cd worker
   npm install
   ```

3. **Set up Supabase Database**
   - Go to your Supabase Dashboard → SQL Editor
   - Copy the contents of `supabase/migrations/001_bot_setup.sql`
   - Run the SQL script to create tables and policies

4. **Configure Environment Secrets**
   ```bash
   npx wrangler secret put ADMIN_USERNAME
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```

5. **Deploy to Cloudflare**
   ```bash
   npx wrangler deploy
   ```
   *Note the generated URL (e.g., `https://link-vault-bot.username.workers.dev`)*

6. **Set Telegram Webhook**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR-WORKER-URL>.workers.dev/webhook"
   ```

7. **Start Using**
   - Open your bot in Telegram
   - Send `/login <your-username> <your-password>`
   - Start sending links!

## Environment Variables

All secrets are stored securely in Cloudflare Workers KV.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ADMIN_USERNAME` | ✅ | Admin username for authentication | `admin` |
| `ADMIN_PASSWORD` | ✅ | Admin password for authentication | `securepass123` |
| `SUPABASE_URL` | ✅ | Your Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ | Supabase Anon/Public Key (NOT Service Role) | `eyJhbG...` |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from BotFather | `123456:ABC-DEF...` |

Create a `.env` file locally for testing (not committed to git):

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=securepass123
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

## Usage

### Basic Workflow

1. **Authenticate**:
   ```
   /login admin mysecretpassword
   ```

2. **Save a Link**:
   - Simply send any URL: `https://github.com`
   - Bot replies with a preview and `[✅ Save] [❌ Cancel]` buttons
   - Click **Save** to store it

3. **View Links**:
   ```
   /list
   /list github
   ```

4. **Delete a Link**:
   ```
   /delete 5
   ```

### Advanced Workflows

- **Backup Data**: `/backup` → Receives a JSON file of all links
- **Restore Data**: Reply to a backup file with `/restore`
- **View Stats**: `/stats` → See total links and storage usage

## Commands

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/login` | `<username> <password>` | Authenticate as admin |
| `/add` | `<url> [title]` | Manually add a link |
| `/list` | `[query]` | List all links or search by keyword |
| `/delete` | `<id>` | Delete a link by its sequential ID |
| `/backup` | - | Export all links as JSON |
| `/restore` | (Reply to file) | Import links from JSON backup |
| `/stats` | - | Show database statistics |
| `/help` | - | Display command help |

## Database

**Type**: PostgreSQL (via Supabase)

### Tables

#### `links`
Stores saved URLs with metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Sequential unique ID (1, 2, 3...) |
| `telegram_user_id` | BIGINT | Owner's Telegram ID (for multi-user support) |
| `url` | TEXT | The saved URL (unique per user) |
| `page_title` | TEXT | Extracted page title |
| `category` | TEXT | Optional category tag |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

#### `bot_sessions`
Tracks authenticated users and rate limits.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Session ID |
| `telegram_user_id` | BIGINT | User's Telegram ID |
| `username` | TEXT | Telegram username |
| `is_authenticated` | BOOLEAN | Auth status |
| `last_active` | TIMESTAMPTZ | Last activity timestamp |
| `request_count` | INTEGER | Rate limit counter |

### Row-Level Security (RLS)

- Users can only access their own links (`telegram_user_id` match)
- Admin bypass enabled via policy
- All writes require authentication

## Development

### Local Testing

Since Cloudflare Workers run in a specialized environment, use Wrangler's local dev server:

```bash
npx wrangler dev --local
```

*Note: You will need to tunnel this to Telegram for webhook testing (e.g., using ngrok).*

### Code Style

- **Formatter**: Prettier (configured in `tsconfig.json`)
- **Linter**: ESLint (recommended setup)
- **Imports**: Absolute imports from `src/`

### Recommended Workflow

1. Make changes in `worker/src/`
2. Run `npm run typecheck` to verify TypeScript
3. Deploy with `npx wrangler deploy`
4. Test in Telegram

## Testing

Currently, the project relies on manual testing via Telegram. Recommended future tests:

```bash
# Run unit tests (when implemented)
npm test

# Run integration tests
npm run test:integration
```

**Critical Test Scenarios**:
- Concurrent link saves (race conditions)
- Invalid URL handling
- SSRF attack attempts
- Session expiration
- Backup/Restore integrity

## Deployment

### Production Deployment

```bash
npx wrangler deploy --prod
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
```

### Scaling

- **Cloudflare Workers**: Auto-scales globally
- **Supabase**: Upgrade plan for more database capacity
- **Rate Limiting**: Built-in to prevent abuse

## Security

This project implements several security best practices:

- **No Legacy Keys**: Uses Supabase Anon Key + RLS instead of Service Role keys
- **SSRF Protection**: Validates URLs against private IP ranges before fetching
- **Input Sanitization**: Escapes HTML in user-generated content
- **Rate Limiting**: Prevents brute-force attacks (10 req/min)
- **Session Management**: Database-backed auth with timeout
- **Error Handling**: Generic error messages to prevent info leakage

### Security Checklist

- [x] No hardcoded secrets
- [x] RLS enabled on all tables
- [x] HTTPS enforced
- [x] Input validation on all endpoints
- [x] Protection against SSRF
- [ ] Penetration testing (recommended)

## Troubleshooting

### Common Issues

**1. "Unauthorized" Error**
- Ensure you ran `/login` with correct credentials
- Check `ADMIN_USERNAME` and `ADMIN_PASSWORD` secrets in Cloudflare

**2. Webhook Not Receiving Messages**
- Verify webhook URL: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Ensure Cloudflare Worker is deployed successfully
- Check Cloudflare Logs for errors

**3. Database Connection Failed**
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Ensure RLS policies are created in Supabase
- Check Supabase dashboard for connection logs

**4. Links Not Saving**
- Check if `links` table exists
- Verify `telegram_user_id` is being captured
- Review Cloudflare Worker logs for specific errors

**5. "Page Title Could Not Be Fetched"**
- The URL might be blocking bots (robots.txt)
- Network timeout during fetch
- Invalid URL format

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: Use conventional commits (`feat:`, `fix:`, `chore:`)
4. **Test**: Ensure all manual flows work
5. **Push**: `git push origin feature/amazing-feature`
6. **Open PR**: Describe your changes and reference any issues

### Coding Guidelines

- Use TypeScript strict mode
- Handle all async errors with try/catch
- Add comments for complex logic
- Keep functions small and single-purpose

## Roadmap

- [ ] **Multi-User Support**: Allow multiple admins with separate link collections
- [ ] **Categories/Tags**: Organize links with custom tags
- [ ] **Scheduled Backups**: Auto-backup to S3/GCS weekly
- [ ] **Link Health Checks**: Periodically verify saved URLs are alive
- [ ] **Preview Images**: Generate OG images for saved links
- [ ] **Shareable Links**: Public read-only views for specific links
- [ ] **Browser Extension**: Companion extension to send tabs to bot
- [ ] **Analytics Dashboard**: Visual charts for link usage

## License

This project currently has no explicit license. Please contact the maintainer for usage rights.

---

*Built with ❤️ using Cloudflare Workers and Supabase*
