import type { Env } from "./types";

/** Thin wrapper around the Telegram Bot API. */
export class Telegram {
  constructor(private env: Env) {}

  private async call<T = unknown>(method: string, payload: unknown): Promise<T> {
    const res = await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description}`);
    return json.result as T;
  }

  sendMessage(chat_id: number, text: string, extra: Record<string, unknown> = {}) {
    return this.call("sendMessage", {
      chat_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  }

  editMessageText(chat_id: number, message_id: number, text: string, extra: Record<string, unknown> = {}) {
    return this.call("editMessageText", {
      chat_id,
      message_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  }

  answerCallbackQuery(callback_query_id: string, text?: string, show_alert = false) {
    return this.call("answerCallbackQuery", { callback_query_id, text, show_alert });
  }

  answerInlineQuery(inline_query_id: string, results: unknown[], extra: Record<string, unknown> = {}) {
    return this.call("answerInlineQuery", {
      inline_query_id,
      results,
      cache_time: 5,
      is_personal: true,
      ...extra,
    });
  }

  sendDocument(chat_id: number, filename: string, content: string, caption?: string) {
    const form = new FormData();
    form.append("chat_id", String(chat_id));
    if (caption) form.append("caption", caption);
    form.append("document", new Blob([content], { type: "application/json" }), filename);
    return fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: form,
    });
  }

  async getFile(file_id: string): Promise<{ file_path: string }> {
    return this.call("getFile", { file_id });
  }

  async downloadFile(file_path: string): Promise<string> {
    const res = await fetch(`https://api.telegram.org/file/bot${this.env.TELEGRAM_BOT_TOKEN}/${file_path}`);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    return res.text();
  }

  setWebhook(url: string, secret_token: string) {
    return this.call("setWebhook", {
      url,
      secret_token,
      allowed_updates: ["message", "callback_query", "inline_query", "chosen_inline_result"],
    });
  }

  deleteWebhook() {
    return this.call("deleteWebhook", { drop_pending_updates: true });
  }
}
