import type { Env, Link, BotSession } from "./types";

/**
 * Minimal Supabase REST (PostgREST) client built on `fetch`.
 * Uses the new Supabase API key model: the secret key (`sb_secret_…`) bypasses RLS
 * and is only ever used here, server-side, inside the Worker.
 */
export class Supabase {
  constructor(private env: Env) {}

  private headers(extra: Record<string, string> = {}): HeadersInit {
    return {
      apikey: this.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private url(path: string, query?: Record<string, string>): string {
    const u = new URL(`/rest/v1/${path}`, this.env.SUPABASE_URL);
    if (query) for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    return u.toString();
  }

  private async req<T>(
    method: string,
    path: string,
    opts: { query?: Record<string, string>; body?: unknown; prefer?: string } = {},
  ): Promise<T> {
    const headers = this.headers(opts.prefer ? { Prefer: opts.prefer } : {});
    const res = await fetch(this.url(path, opts.query), {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${method} ${path} -> ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // -------- bot_users --------
  async upsertUser(u: {
    telegram_id: number;
    username?: string | null;
    first_name?: string | null;
  }): Promise<void> {
    await this.req("POST", "bot_users", {
      body: { ...u, last_seen_at: new Date().toISOString() },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  async setAdmin(telegram_id: number, is_admin: boolean): Promise<void> {
    await this.req("PATCH", "bot_users", {
      query: { telegram_id: `eq.${telegram_id}` },
      body: { is_admin },
      prefer: "return=minimal",
    });
  }

  async getUser(telegram_id: number): Promise<{ is_admin: boolean } | null> {
    const rows = await this.req<{ is_admin: boolean }[]>("GET", "bot_users", {
      query: { telegram_id: `eq.${telegram_id}`, select: "is_admin", limit: "1" },
    });
    return rows[0] ?? null;
  }

  // -------- bot_sessions --------
  async getSession(telegram_id: number): Promise<BotSession | null> {
    const rows = await this.req<BotSession[]>("GET", "bot_sessions", {
      query: { telegram_id: `eq.${telegram_id}`, limit: "1" },
    });
    return rows[0] ?? null;
  }

  async upsertSession(s: Partial<BotSession> & { telegram_id: number }): Promise<void> {
    await this.req("POST", "bot_sessions", {
      body: { ...s, updated_at: new Date().toISOString() },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  async clearSessionToken(telegram_id: number): Promise<void> {
    await this.req("PATCH", "bot_sessions", {
      query: { telegram_id: `eq.${telegram_id}` },
      body: { token_hash: null, expires_at: null },
      prefer: "return=minimal",
    });
  }

  async setSessionState(telegram_id: number, state: Record<string, unknown>): Promise<void> {
    await this.upsertSession({ telegram_id, state });
  }

  // -------- links --------
  async addLink(l: {
    owner_telegram_id: number;
    title: string;
    page_title?: string | null;
    url: string;
    category?: string | null;
  }): Promise<Link> {
    const rows = await this.req<Link[]>("POST", "links", {
      body: l,
      prefer: "return=representation",
    });
    return rows[0];
  }

  async listLinks(
    owner: number,
    opts: { offset?: number; limit?: number; query?: string } = {},
  ): Promise<Link[]> {
    const q: Record<string, string> = {
      owner_telegram_id: `eq.${owner}`,
      order: "created_at.desc",
      limit: String(opts.limit ?? 10),
      offset: String(opts.offset ?? 0),
      select: "*",
    };
    if (opts.query) {
      const escaped = opts.query.replace(/[%,*()]/g, " ").trim();
      if (escaped) q.or = `(title.ilike.*${escaped}*,page_title.ilike.*${escaped}*,url.ilike.*${escaped}*,category.ilike.*${escaped}*)`;
    }
    return this.req<Link[]>("GET", "links", { query: q });
  }

  async countLinks(owner: number, query?: string): Promise<number> {
    const q: Record<string, string> = {
      owner_telegram_id: `eq.${owner}`,
      select: "id",
    };
    if (query) {
      const escaped = query.replace(/[%,*()]/g, " ").trim();
      if (escaped) q.or = `(title.ilike.*${escaped}*,page_title.ilike.*${escaped}*,url.ilike.*${escaped}*,category.ilike.*${escaped}*)`;
    }
    const res = await fetch(this.url("links", q), {
      method: "HEAD",
      headers: this.headers({ Prefer: "count=exact" }),
    });
    const range = res.headers.get("content-range") ?? "";
    const total = Number(range.split("/")[1] ?? 0);
    return Number.isFinite(total) ? total : 0;
  }

  async getLink(owner: number, id: string): Promise<Link | null> {
    const rows = await this.req<Link[]>("GET", "links", {
      query: { id: `eq.${id}`, owner_telegram_id: `eq.${owner}`, limit: "1", select: "*" },
    });
    return rows[0] ?? null;
  }

  async deleteLink(owner: number, id: string): Promise<void> {
    await this.req("DELETE", "links", {
      query: { id: `eq.${id}`, owner_telegram_id: `eq.${owner}` },
      prefer: "return=minimal",
    });
  }

  async allLinksFor(owner: number): Promise<Link[]> {
    return this.req<Link[]>("GET", "links", {
      query: { owner_telegram_id: `eq.${owner}`, order: "created_at.asc", select: "*" },
    });
  }

  async bulkInsertLinks(rows: Array<{
    owner_telegram_id: number;
    title: string;
    page_title?: string | null;
    url: string;
    category?: string | null;
  }>): Promise<number> {
    if (rows.length === 0) return 0;
    const inserted = await this.req<{ id: string }[]>("POST", "links", {
      body: rows,
      prefer: "return=representation,resolution=ignore-duplicates",
    });
    return inserted.length;
  }

  async stats(owner: number): Promise<{ total: number; categories: number }> {
    const total = await this.countLinks(owner);
    const cats = await this.req<{ category: string | null }[]>("GET", "links", {
      query: { owner_telegram_id: `eq.${owner}`, select: "category" },
    });
    const set = new Set(cats.map((r) => r.category).filter((c): c is string => !!c));
    return { total, categories: set.size };
  }
}
