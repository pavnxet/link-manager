import type { Env } from "./types";
import { Bot } from "./bot";
import { Telegram } from "./telegram";
import { allow } from "./ratelimit";
import { timingSafeEqual } from "./crypto";

function missingSecrets(env: Env): string[] {
  const required: (keyof Env)[] = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD_HASH",
  ];
  return required.filter((k) => !env[k] || String(env[k]).trim() === "");
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Health
    if (url.pathname === "/" || url.pathname === "/health") {
      const missing = missingSecrets(env);
      const body = missing.length === 0 ? "ok v3" : `ok v3 (missing secrets: ${missing.join(", ")})`;
      return new Response(body, { status: 200 });
    }

    // Diagnostic: confirms which version is live + reports secret lengths (not values).
    if (url.pathname === "/diag" && req.method === "GET") {
      const provided = url.searchParams.get("secret") ?? "";
      if (!timingSafeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("forbidden\n", { status: 403 });
      }
      const lens: Record<string, number | string> = {};
      const keys: (keyof Env)[] = [
        "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET",
        "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
        "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "BOT_USERNAME",
      ];
      for (const k of keys) {
        const v = env[k];
        lens[k] = v == null ? "(missing)" : `len=${String(v).length} trimmed=${String(v).trim().length}`;
      }
      return new Response(JSON.stringify({ version: "v3", env: lens }, null, 2), {
        headers: { "content-type": "application/json" },
      });
    }

    // Webhook receiver — path includes secret
    if (url.pathname === `/webhook/${env.TELEGRAM_WEBHOOK_SECRET}` && req.method === "POST") {
      // Defense in depth: check Telegram's secret-token header too
      const headerSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (!timingSafeEqual(headerSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("forbidden", { status: 403 });
      }
      const update = (await req.json()) as any;
      const userId =
        update.message?.from?.id ??
        update.callback_query?.from?.id ??
        update.inline_query?.from?.id;
      if (userId && !allow(userId)) return new Response("ok"); // silently drop
      try {
        await new Bot(env).handle(update);
      } catch (e) {
        console.error("Bot error:", e);
      }
      return new Response("ok");
    }

    // Admin: register webhook with Telegram. Requires the same secret as a query param.
    if (url.pathname === "/setup" && req.method === "GET") {
      try {
        const missing = missingSecrets(env);
        if (missing.length > 0) {
          return new Response(`Cannot setup — missing secrets: ${missing.join(", ")}\n`, { status: 500 });
        }
        const provided = url.searchParams.get("secret") ?? "";
        if (!timingSafeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
          return new Response("forbidden\n", { status: 403 });
        }
        const base = `${url.protocol}//${url.host}`;
        const hookUrl = `${base}/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
        await new Telegram(env).setWebhook(hookUrl, env.TELEGRAM_WEBHOOK_SECRET);
        return new Response(`Webhook set to ${hookUrl}\n`, { status: 200 });
      } catch (e: any) {
        return new Response(`Failed: ${e?.message ?? String(e)}\n`, { status: 500 });
      }
    }

    if (url.pathname === "/teardown" && req.method === "GET") {
      try {
        const provided = url.searchParams.get("secret") ?? "";
        if (!timingSafeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
          return new Response("forbidden\n", { status: 403 });
        }
        await new Telegram(env).deleteWebhook();
        return new Response("Webhook deleted\n");
      } catch (e: any) {
        return new Response(`Failed: ${e?.message ?? String(e)}\n`, { status: 500 });
      }
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
