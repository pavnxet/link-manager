export interface Env {
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string; // Use service_role key (sb_secret_...) for server-side
  TELEGRAM_BOT_TOKEN: string;
}

export interface Link {
  id: number; // Auto-incremented integer ID
  user_id: string; // UUID of the owner
  telegram_user_id: number; // Telegram user ID for quick lookup
  title: string;
  page_title?: string;
  url: string;
  category?: string;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotSession {
  id: string;
  telegram_user_id: number;
  telegram_username?: string;
  is_authenticated: boolean;
  last_active: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
  };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  message: TelegramMessage;
  data: string;
  from: {
    id: number;
    username?: string;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}
