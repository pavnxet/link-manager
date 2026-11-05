export interface Link {
  id: string;
  title: string;
  page_title: string | null;
  url: string;
  category: string | null;
  created_at: string;
}

export interface LinkInsert {
  title: string;
  page_title?: string;
  url: string;
  category?: string;
  created_at?: string;
}

export interface LinkUpdate {
  title?: string;
  page_title?: string;
  url?: string;
  category?: string;
}

export interface DbClient {
  getLinks(query?: string | null): Promise<Link[]>;
  getLinkById(id: string): Promise<Link | null>;
  addLink(link: LinkInsert): Promise<Link>;
  updateLink(id: string, link: LinkUpdate): Promise<Link>;
  deleteLink(id: string): Promise<void>;
  getNextNumericId(): Promise<number>;
  getAllLinksForBackup(): Promise<Link[]>;
  bulkInsertLinks(links: LinkInsert[]): Promise<{ success: boolean; count: number }>;
}

/**
 * Highest numeric title + 1, computed in JS from whatever the database returns.
 *
 * Doing this in the application instead of SQL removes a whole class of bugs: `CAST(title AS
 * INTEGER)` and `GLOB` predicates quietly exclude padded, spaced, NBSP-padded or BLOB titles, and
 * when they excluded *everything* the counter fell back to 1 — so a fresh upload was saved as
 * entry "1" next to 365 existing links.
 *
 * Accepts strings, numbers and Buffers (a restored backup can hand back any of them).
 */
export function nextNumericIdFromTitles(titles: Iterable<unknown>): number {
  let max = 0
  for (const raw of titles) {
    if (raw === null || raw === undefined) continue
    const trimmed = (typeof raw === 'string' ? raw : String(raw)).trim()
    if (!/^\d+$/.test(trimmed)) continue
    const value = Number(trimmed)
    if (Number.isSafeInteger(value) && value > max) max = value
  }
  return max + 1
}

let dbClientInstance: DbClient | null = null;

export async function getDb(): Promise<DbClient> {
  if (dbClientInstance) {
    return dbClientInstance;
  }

  // Default to 'turso' as requested for the move away from Supabase
  const provider = process.env.DB_PROVIDER || 'turso';

  try {
    if (provider === 'turso') {
      const { TursoDbClient } = await import('./db/turso');
      dbClientInstance = new TursoDbClient();
    } else if (provider === 'supabase') {
      const { SupabaseDbClient } = await import('./db/supabase');
      dbClientInstance = new SupabaseDbClient();
    } else {
      throw new Error(`Unsupported database provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Failed to initialize database provider "${provider}":`, error);
    throw error;
  }

  return dbClientInstance;
}
