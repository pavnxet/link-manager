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

let dbClientInstance: DbClient | null = null;

export async function getDb(): Promise<DbClient> {
  if (dbClientInstance) {
    return dbClientInstance;
  }

  const provider = process.env.DB_PROVIDER || 'supabase';

  if (provider === 'turso') {
    const { TursoDbClient } = await import('./db/turso');
    dbClientInstance = new TursoDbClient();
  } else {
    const { SupabaseDbClient } = await import('./db/supabase');
    dbClientInstance = new SupabaseDbClient();
  }

  return dbClientInstance;
}
