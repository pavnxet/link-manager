import type { Env } from "./types";
import { Bot } from "./bot";
import { Telegram } from "./telegram";
import { allow } from "./ratelimit";
import { timingSafeEqual } from "./crypto";

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Health
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { status: 200 });
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
      const provided = url.searchParams.get("secret") ?? "";
      if (!timingSafeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("forbidden", { status: 403 });
      }
      const base = `${url.protocol}//${url.host}`;
      const hookUrl = `${base}/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
      try {
        await new Telegram(env).setWebhook(hookUrl, env.TELEGRAM_WEBHOOK_SECRET);
        return new Response(`Webhook set to ${hookUrl}\n`, { status: 200 });
      } catch (e: any) {
        return new Response(`Failed: ${e.message}\n`, { status: 500 });
      }
    }

    if (url.pathname === "/teardown" && req.method === "GET") {
      const provided = url.searchParams.get("secret") ?? "";
      if (!timingSafeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("forbidden", { status: 403 });
      }
      await new Telegram(env).deleteWebhook();
      return new Response("Webhook deleted\n");
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
