# Web

Next.js 16 app (App Router) migrated from Vercel to Replit.

## Stack
- Next.js 16 + React 19, Turbopack
- Tailwind CSS v4
- Auth via JWT (jose) with `auth-token` cookie + middleware
- DB providers: Supabase or Turso (libsql), selected via `DB_PROVIDER`

## Replit setup
- Workflow `Start application` runs `npm run dev` on port 5000 (host 0.0.0.0)
- `next.config.ts` sets `allowedDevOrigins: ["*"]` for the Replit iframe proxy

## Required env vars (Secrets)
- `JWT_SECRET` (required for production)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `DB_PROVIDER` = `supabase` | `turso`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Turso: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
