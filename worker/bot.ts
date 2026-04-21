import type { Env, Link } from "./types";
import { Supabase } from "./supabase";
import { Telegram } from "./telegram";
import { sha256Hex, randomToken, timingSafeEqual } from "./crypto";
import { fetchPageTitle, isValidHttpUrl } from "./scrape";

const HELP = `<b>Links Bot</b>
Manage your saved links right from Telegram.

<b>Commands</b>
/login &lt;user&gt; &lt;pass&gt; — sign in as admin
/logout — end your session
/whoami — show session info
/add &lt;url&gt; [title] — save a link
/list [page] — list your links
/search &lt;query&gt; — search title/url/category
/get &lt;id-prefix&gt; — show one link
/delete &lt;id-prefix&gt; — remove a link
/category &lt;id&gt; &lt;name&gt; — set category
/stats — show counters
/export — download all links as JSON
/import — reply with /import then upload a JSON file
/cancel — cancel a pending action

<b>Inline mode</b>
Type <code>@${"BOT"} query</code> in any chat to search and share your links.`;

export class Bot {
  private tg: Telegram;
  private db: Supabase;
  constructor(private env: Env) {
    this.tg = new Telegram(env);
    this.db = new Supabase(env);
  }

  // ---------------- Update dispatch ----------------
  async handle(update: any): Promise<void> {
    if (update.message) await this.onMessage(update.message);
    else if (update.callback_query) await this.onCallback(update.callback_query);
    else if (update.inline_query) await this.onInline(update.inline_query);
  }

  // ---------------- Auth helpers ----------------
  private sessionTtlMs(): number {
    return Number(this.env.SESSION_TTL_DAYS ?? "7") * 86400_000;
  }

  private async isAuthed(telegram_id: number): Promise<boolean> {
    const s = await this.db.getSession(telegram_id);
    if (!s?.token_hash || !s.expires_at) return false;
    if (Date.parse(s.expires_at) < Date.now()) return false;
    const u = await this.db.getUser(telegram_id);
    return !!u?.is_admin;
  }

  private async requireAuth(chat_id: number, telegram_id: number): Promise<boolean> {
    if (await this.isAuthed(telegram_id)) return true;
    await this.tg.sendMessage(chat_id, "🔒 Please sign in first: <code>/login &lt;username&gt; &lt;password&gt;</code>");
    return false;
  }

  // ---------------- Messages ----------------
  private async onMessage(msg: any): Promise<void> {
    const chat_id = msg.chat.id;
    const from = msg.from;
    if (!from) return;
    const tgid: number = from.id;

    await this.db.upsertUser({
      telegram_id: tgid,
      username: from.username ?? null,
      first_name: from.first_name ?? null,
    });

    // File upload while awaiting import?
    if (msg.document) {
      const session = await this.db.getSession(tgid);
      if (session?.state && (session.state as any).awaiting === "import_file") {
        return this.handleImportFile(chat_id, tgid, msg.document);
      }
    }

    const text: string = msg.text ?? "";
    if (!text.startsWith("/")) {
      // free-form: try to interpret as URL to save when authed
      if (await this.isAuthed(tgid) && isValidHttpUrl(text.trim().split(/\s+/)[0])) {
        return this.cmdAdd(chat_id, tgid, text.trim());
      }
      return;
    }

    const [rawCmd, ...rest] = text.split(/\s+/);
    const cmd = rawCmd.split("@")[0].toLowerCase();
    const arg = rest.join(" ").trim();

    switch (cmd) {
      case "/start":   return this.cmdStart(chat_id);
      case "/help":    return this.cmdHelp(chat_id);
      case "/login":   return this.cmdLogin(chat_id, tgid, rest);
      case "/logout":  return this.cmdLogout(chat_id, tgid);
      case "/whoami":  return this.cmdWhoami(chat_id, tgid);
      case "/add":     if (!(await this.requireAuth(chat_id, tgid))) return; return this.cmdAdd(chat_id, tgid, arg);
      case "/list":    if (!(await this.requireAuth(chat_id, tgid))) return; return this.cmdList(chat_id, tgid, parseInt(arg || "1", 10) || 1);
      case "/search":  if (!(await this.requireAuth(chat_id, tgid))) return; return this.cmdSearch(chat_id, tgid, arg);
      case "/get":     if (!(await this.requireAuth(chat_id, tgid))) return; await this.cmdGet(chat_id, tgid, arg); return;
      case "/delete":  if (!(await this.requireAuth(chat_id, tgid))) return; await this.cmdDelete(chat_id, tgid, arg); return;
      case "/category":if (!(await this.requireAuth(chat_id, tgid))) return; await this.cmdCategory(chat_id, tgid, rest); return;
      case "/stats":   if (!(await this.requireAuth(chat_id, tgid))) return; return this.cmdStats(chat_id, tgid);
      case "/export":  if (!(await this.requireAuth(chat_id, tgid))) return; return this.cmdExport(chat_id, tgid);
      case "/import":  if (!(await this.requireAuth(chat_id, tgid))) return; return this.cmdImport(chat_id, tgid);
      case "/cancel":  return this.cmdCancel(chat_id, tgid);
      default:
        await this.tg.sendMessage(chat_id, "Unknown command. Try /help.");
    }
  }

  // ---------------- Commands ----------------
  private async cmdStart(chat_id: number) {
    await this.tg.sendMessage(chat_id, helpText(this.env));
  }
  private async cmdHelp(chat_id: number) {
    await this.tg.sendMessage(chat_id, helpText(this.env));
  }

  private async cmdLogin(chat_id: number, tgid: number, parts: string[]) {
    if (parts.length < 2) {
      await this.tg.sendMessage(chat_id, "Usage: <code>/login &lt;username&gt; &lt;password&gt;</code>");
      return;
    }
    const [username, ...pwParts] = parts;
    const password = pwParts.join(" ");
    const passHash = await sha256Hex(password);
    const userOk = timingSafeEqual(username, this.env.ADMIN_USERNAME);
    const passOk = timingSafeEqual(passHash, this.env.ADMIN_PASSWORD_HASH);
    if (!(userOk && passOk)) {
      await this.tg.sendMessage(chat_id, "❌ Invalid credentials.");
      return;
    }
    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + this.sessionTtlMs()).toISOString();
    await this.db.setAdmin(tgid, true);
    await this.db.upsertSession({ telegram_id: tgid, token_hash: tokenHash, expires_at: expires, state: {} });
    await this.tg.sendMessage(chat_id, `✅ Signed in. Session valid until <code>${expires}</code>.`);
  }

  private async cmdLogout(chat_id: number, tgid: number) {
    await this.db.clearSessionToken(tgid);
    await this.db.setSessionState(tgid, {});
    await this.tg.sendMessage(chat_id, "👋 Signed out.");
  }

  private async cmdWhoami(chat_id: number, tgid: number) {
    const authed = await this.isAuthed(tgid);
    const s = await this.db.getSession(tgid);
    const lines = [
      `<b>Telegram ID:</b> <code>${tgid}</code>`,
      `<b>Authed:</b> ${authed ? "yes" : "no"}`,
      s?.expires_at ? `<b>Session expires:</b> <code>${s.expires_at}</code>` : "",
    ].filter(Boolean);
    await this.tg.sendMessage(chat_id, lines.join("\n"));
  }

  private async cmdAdd(chat_id: number, tgid: number, raw: string) {
    if (!raw) {
      await this.tg.sendMessage(chat_id, "Usage: <code>/add &lt;url&gt; [title]</code>");
      return;
    }
    const parts = raw.split(/\s+/);
    const url = parts[0];
    let title = parts.slice(1).join(" ").trim();
    if (!isValidHttpUrl(url)) {
      await this.tg.sendMessage(chat_id, "❌ Not a valid http(s) URL.");
      return;
    }
    const page_title = await fetchPageTitle(url);
    if (!title) title = page_title ?? new URL(url).hostname;
    try {
      const link = await this.db.addLink({ owner_telegram_id: tgid, title, page_title, url });
      await this.tg.sendMessage(
        chat_id,
        `✅ Saved <b>${escapeHtml(link.title)}</b>\n<code>${link.id}</code>\n${escapeHtml(link.url)}`,
      );
    } catch (e: any) {
      if (String(e.message).includes("duplicate") || String(e.message).includes("23505")) {
        await this.tg.sendMessage(chat_id, "ℹ️ You already saved this URL.");
      } else {
        throw e;
      }
    }
  }

  private async cmdList(chat_id: number, tgid: number, page: number) {
    const pageSize = Number(this.env.PAGE_SIZE ?? "10");
    const offset = (page - 1) * pageSize;
    const total = await this.db.countLinks(tgid);
    const rows = await this.db.listLinks(tgid, { offset, limit: pageSize });
    if (rows.length === 0) {
      await this.tg.sendMessage(chat_id, "No links yet. Use <code>/add &lt;url&gt;</code> to save one.");
      return;
    }
    const text = renderList(rows, page, total, pageSize);
    await this.tg.sendMessage(chat_id, text, { reply_markup: paginationKeyboard(page, total, pageSize, "list") });
  }

  private async cmdSearch(chat_id: number, tgid: number, q: string) {
    if (!q) {
      await this.tg.sendMessage(chat_id, "Usage: <code>/search &lt;query&gt;</code>");
      return;
    }
    const rows = await this.db.listLinks(tgid, { query: q, limit: 20 });
    if (rows.length === 0) {
      await this.tg.sendMessage(chat_id, `No matches for <i>${escapeHtml(q)}</i>.`);
      return;
    }
    await this.tg.sendMessage(chat_id, renderList(rows, 1, rows.length, rows.length, `Search: ${q}`));
  }

  private async cmdGet(chat_id: number, tgid: number, idPrefix: string) {
    if (!idPrefix) return this.tg.sendMessage(chat_id, "Usage: <code>/get &lt;id-prefix&gt;</code>");
    const link = await this.findByPrefix(tgid, idPrefix);
    if (!link) return this.tg.sendMessage(chat_id, "❌ No link matches that id.");
    await this.tg.sendMessage(chat_id, renderOne(link), { reply_markup: linkActionsKeyboard(link.id) });
  }

  private async cmdDelete(chat_id: number, tgid: number, idPrefix: string) {
    if (!idPrefix) return this.tg.sendMessage(chat_id, "Usage: <code>/delete &lt;id-prefix&gt;</code>");
    const link = await this.findByPrefix(tgid, idPrefix);
    if (!link) return this.tg.sendMessage(chat_id, "❌ No link matches that id.");
    await this.db.deleteLink(tgid, link.id);
    await this.tg.sendMessage(chat_id, `🗑️ Deleted <b>${escapeHtml(link.title)}</b>.`);
  }

  private async cmdCategory(chat_id: number, tgid: number, parts: string[]) {
    const idPrefix = parts[0];
    const cat = parts.slice(1).join(" ").trim();
    if (!idPrefix || !cat) return this.tg.sendMessage(chat_id, "Usage: <code>/category &lt;id&gt; &lt;name&gt;</code>");
    const link = await this.findByPrefix(tgid, idPrefix);
    if (!link) return this.tg.sendMessage(chat_id, "❌ No link matches that id.");
    // PATCH single field via raw call (reuse addLink path is awkward; use db directly)
    await fetch(`${this.env.SUPABASE_URL}/rest/v1/links?id=eq.${link.id}&owner_telegram_id=eq.${tgid}`, {
      method: "PATCH",
      headers: {
        apikey: this.env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ category: cat }),
    });
    await this.tg.sendMessage(chat_id, `🏷️ Set category of <b>${escapeHtml(link.title)}</b> to <code>${escapeHtml(cat)}</code>.`);
  }

  private async cmdStats(chat_id: number, tgid: number) {
    const s = await this.db.stats(tgid);
    await this.tg.sendMessage(chat_id, `📊 <b>Stats</b>\nLinks: <b>${s.total}</b>\nCategories: <b>${s.categories}</b>`);
  }

  private async cmdExport(chat_id: number, tgid: number) {
    const all = await this.db.allLinksFor(tgid);
    const json = JSON.stringify({ exported_at: new Date().toISOString(), links: all }, null, 2);
    await this.tg.sendDocument(chat_id, `links-${Date.now()}.json`, json, `Exported ${all.length} link(s).`);
  }

  private async cmdImport(chat_id: number, tgid: number) {
    await this.db.setSessionState(tgid, { awaiting: "import_file" });
    await this.tg.sendMessage(chat_id, "📥 Send the JSON file now (the same shape as /export). Use /cancel to abort.");
  }

  private async cmdCancel(chat_id: number, tgid: number) {
    await this.db.setSessionState(tgid, {});
    await this.tg.sendMessage(chat_id, "Cancelled.");
  }

  private async handleImportFile(chat_id: number, tgid: number, doc: any) {
    try {
      if (doc.file_size && doc.file_size > 5 * 1024 * 1024) {
        await this.tg.sendMessage(chat_id, "❌ File too large (>5MB).");
        return;
      }
      const file = await this.tg.getFile(doc.file_id);
      const text = await this.tg.downloadFile(file.file_path);
      const parsed = JSON.parse(text);
      const items: any[] = Array.isArray(parsed) ? parsed : parsed.links ?? [];
      const rows = items
        .filter((it) => it && typeof it.url === "string" && isValidHttpUrl(it.url))
        .map((it) => ({
          owner_telegram_id: tgid,
          title: String(it.title ?? new URL(it.url).hostname).slice(0, 300),
          page_title: it.page_title ? String(it.page_title).slice(0, 300) : null,
          url: it.url,
          category: it.category ? String(it.category).slice(0, 100) : null,
        }));
      const inserted = await this.db.bulkInsertLinks(rows);
      await this.db.setSessionState(tgid, {});
      await this.tg.sendMessage(chat_id, `✅ Imported ${inserted}/${rows.length} link(s).`);
    } catch (e: any) {
      await this.tg.sendMessage(chat_id, `❌ Import failed: ${escapeHtml(String(e.message ?? e))}`);
    }
  }

  // ---------------- Callbacks ----------------
  private async onCallback(cq: any): Promise<void> {
    const data: string = cq.data ?? "";
    const tgid: number = cq.from.id;
    const chat_id: number = cq.message.chat.id;
    const message_id: number = cq.message.message_id;

    if (!(await this.isAuthed(tgid))) {
      await this.tg.answerCallbackQuery(cq.id, "Sign in first.", true);
      return;
    }

    const [action, ...args] = data.split(":");
    try {
      if (action === "list") {
        const page = parseInt(args[0] ?? "1", 10) || 1;
        const pageSize = Number(this.env.PAGE_SIZE ?? "10");
        const total = await this.db.countLinks(tgid);
        const rows = await this.db.listLinks(tgid, { offset: (page - 1) * pageSize, limit: pageSize });
        await this.tg.editMessageText(chat_id, message_id, renderList(rows, page, total, pageSize), {
          reply_markup: paginationKeyboard(page, total, pageSize, "list"),
        });
      } else if (action === "del") {
        const id = args[0];
        await this.tg.editMessageText(chat_id, message_id, "Confirm delete?", {
          reply_markup: { inline_keyboard: [[
            { text: "✅ Yes, delete", callback_data: `delc:${id}` },
            { text: "❌ Cancel", callback_data: `noop` },
          ]] },
        });
      } else if (action === "delc") {
        const id = args[0];
        await this.db.deleteLink(tgid, id);
        await this.tg.editMessageText(chat_id, message_id, "🗑️ Deleted.");
      } else if (action === "open") {
        const id = args[0];
        const link = await this.db.getLink(tgid, id);
        if (!link) {
          await this.tg.editMessageText(chat_id, message_id, "❌ Not found.");
        } else {
          await this.tg.editMessageText(chat_id, message_id, renderOne(link), {
            reply_markup: linkActionsKeyboard(link.id),
          });
        }
      } else if (action === "noop") {
        await this.tg.editMessageText(chat_id, message_id, "Cancelled.");
      }
      await this.tg.answerCallbackQuery(cq.id);
    } catch (e: any) {
      await this.tg.answerCallbackQuery(cq.id, `Error: ${e.message}`, true);
    }
  }

  // ---------------- Inline ----------------
  private async onInline(iq: any): Promise<void> {
    const tgid: number = iq.from.id;
    if (!(await this.isAuthed(tgid))) {
      await this.tg.answerInlineQuery(iq.id, [], {
        switch_pm_text: "Sign in to use this bot",
        switch_pm_parameter: "login",
      });
      return;
    }
    const q: string = (iq.query ?? "").trim();
    const rows = await this.db.listLinks(tgid, { query: q || undefined, limit: 25 });
    const results = rows.map((l) => ({
      type: "article",
      id: l.id,
      title: l.title,
      description: l.url,
      url: l.url,
      hide_url: false,
      input_message_content: {
        message_text: `<b>${escapeHtml(l.title)}</b>\n${escapeHtml(l.url)}`,
        parse_mode: "HTML",
      },
      reply_markup: { inline_keyboard: [[{ text: "Open", url: l.url }]] },
    }));
    await this.tg.answerInlineQuery(iq.id, results);
  }

  // ---------------- Helpers ----------------
  private async findByPrefix(owner: number, prefix: string): Promise<Link | null> {
    // try exact numeric id
    if (/^\d$/i.test(prefix)) return this.db.getLink(owner, prefix);
    // else search by ilike on id
    const url = new URL(`/rest/v1/links`, this.env.SUPABASE_URL);
    url.searchParams.set("owner_telegram_id", `eq.${owner}`);
    url.searchParams.set("id", `eq.${prefix}`);
    url.searchParams.set("limit", "2");
    url.searchParams.set("select", "*");
    const res = await fetch(url, {
      headers: {
        apikey: this.env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
      },
    });
    const rows = (await res.json()) as Link[];
    return rows[0] ?? null;
  }
}

// ---------- presentation helpers ----------
function helpText(env: Env): string {
  const botName = env.BOT_USERNAME ?? "your_bot";
  return HELP.replace("BOT", botName);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function renderList(rows: Link[], page: number, total: number, pageSize: number, header = "Your links"): string {
  const lines = [`<b>${header}</b> — ${total} total`, ""];
  for (const l of rows) {
    const id = String(l.id);
    const cat = l.category ? ` · <i>${escapeHtml(l.category)}</i>` : "";
    lines.push(`<code>${id}</code> <a href="${escapeHtml(l.url)}">${escapeHtml(l.title)}</a>${cat}`);
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  lines.push("", `Page ${page}/${totalPages}`);
  return lines.join("\n");
}

function renderOne(l: Link): string {
  return [
    `<b>${escapeHtml(l.title)}</b>`,
    l.page_title ? `<i>${escapeHtml(l.page_title)}</i>` : "",
    `🔗 ${escapeHtml(l.url)}`,
    l.category ? `🏷️ ${escapeHtml(l.category)}` : "",
    `🆔 <code>${l.id}</code>`,
    `🕓 ${l.created_at}`,
  ].filter(Boolean).join("\n");
}

function paginationKeyboard(page: number, total: number, pageSize: number, prefix: string) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const row: any[] = [];
  if (page > 1) row.push({ text: "⬅️ Prev", callback_data: `${prefix}:${page - 1}` });
  if (page < totalPages) row.push({ text: "Next ➡️", callback_data: `${prefix}:${page + 1}` });
  return { inline_keyboard: row.length ? [row] : [] };
}

function linkActionsKeyboard(id: number) {
  return {
    inline_keyboard: [[
      { text: "🗑️ Delete", callback_data: `del:${id}` },
    ]],
  };
}
