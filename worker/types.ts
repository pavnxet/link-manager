export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  BOT_USERNAME?: string;
  SESSION_TTL_DAYS?: string;
  PAGE_SIZE?: string;
}

export interface Link {
  id: number;
  owner_telegram_id: number;
  title: string;
  page_title: string | null;
  url: string;
  category: string | null;
  created_at: string;
}

export interface BotUser {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  is_admin: boolean;
  created_at: string;
  last_seen_at: string;
}

export interface BotSession {
  telegram_id: number;
  token_hash: string | null;
  expires_at: string | null;
  state: Record<string, unknown>;
  updated_at: string;
}
