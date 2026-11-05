import { createClient, Client } from '@libsql/client';
import { DbClient, Link, LinkInsert, LinkUpdate, nextNumericIdFromTitles } from '../db';

let tursoClient: Client | null = null;

/** Escape LIKE metacharacters so a search for "50%" does not match everything. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, ch => `\\${ch}`);
}

function getTursoClient() {
  if (!tursoClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    // Fail loudly instead of quietly writing to a local file: on a serverless host that file is
    // either read-only or thrown away, so the vault would look empty and silently lose writes.
    if (!url || !authToken) {
      throw new Error(
        'Turso is not configured: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN ' +
          '(DB_PROVIDER=turso), or switch DB_PROVIDER to supabase',
      );
    }

    tursoClient = createClient({ url, authToken });
  }
  return tursoClient;
}

export class TursoDbClient implements DbClient {
  async getLinks(query?: string | null): Promise<Link[]> {
    const client = getTursoClient();
    // datetime() parses both the ISO strings this app writes and SQLite's CURRENT_TIMESTAMP
    // default, so rows created either way sort together.
    let sql = 'SELECT * FROM links ORDER BY datetime(created_at) DESC';
    let args: string[] = [];

    if (query) {
      sql = `
        SELECT * FROM links
        WHERE title LIKE ? ESCAPE '\\'
           OR page_title LIKE ? ESCAPE '\\'
           OR category LIKE ? ESCAPE '\\'
           OR url LIKE ? ESCAPE '\\'
        ORDER BY datetime(created_at) DESC
      `;
      const likeQuery = `%${escapeLike(query)}%`;
      args = [likeQuery, likeQuery, likeQuery, likeQuery];
    }

    const { rows } = await client.execute({ sql, args });
    return rows as unknown as Link[];
  }

  async getLinkById(id: string): Promise<Link | null> {
    const client = getTursoClient();
    const { rows } = await client.execute({
      sql: 'SELECT * FROM links WHERE id = ?',
      args: [id]
    });

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as unknown as Link;
  }

  async addLink(link: LinkInsert): Promise<Link> {
    const client = getTursoClient();
    const id = crypto.randomUUID(); // Turso doesn't have a built-in uuidv4 generator like Postgres `gen_random_uuid()`, so we generate it
    const created_at = link.created_at || new Date().toISOString();
    const category = link.category || '🔗 #Link';
    const page_title = link.page_title || '';

    try {
      await client.execute({
        sql: `INSERT INTO links (id, title, page_title, url, category, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, link.title, page_title, link.url, category, created_at]
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes('UNIQUE constraint failed')) {
        const customError = new Error('URL already exists') as Error & { code: string };
        customError.code = '23505'; // Postgres unique violation code for compatibility
        throw customError;
      }
      throw error;
    }

    return this.getLinkById(id) as Promise<Link>;
  }

  async updateLink(id: string, link: LinkUpdate): Promise<Link> {
    const client = getTursoClient();
    const updates: string[] = [];
    const args: string[] = [];

    if (link.title !== undefined) {
      updates.push('title = ?');
      args.push(link.title);
    }
    if (link.page_title !== undefined) {
      updates.push('page_title = ?');
      args.push(link.page_title);
    }
    if (link.url !== undefined) {
      updates.push('url = ?');
      args.push(link.url);
    }
    if (link.category !== undefined) {
      updates.push('category = ?');
      args.push(link.category);
    }

    if (updates.length === 0) {
      return this.getLinkById(id) as Promise<Link>;
    }

    args.push(id);
    const sql = `UPDATE links SET ${updates.join(', ')} WHERE id = ?`;

    try {
      await client.execute({ sql, args });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes('UNIQUE constraint failed')) {
        const customError = new Error('URL already exists') as Error & { code: string };
        customError.code = '23505';
        throw customError;
      }
      throw error;
    }

    return this.getLinkById(id) as Promise<Link>;
  }

  async deleteLink(id: string): Promise<void> {
    const client = getTursoClient();
    await client.execute({
      sql: 'DELETE FROM links WHERE id = ?',
      args: [id]
    });
  }

  async getNextNumericId(): Promise<number> {
    const client = getTursoClient();
    // Errors propagate on purpose. This used to catch everything and return 1, which turned any
    // hiccup into "save this upload as entry #1" instead of a visible failure.
    const { rows } = await client.execute('SELECT title FROM links');
    return nextNumericIdFromTitles(rows.map(row => row.title));
  }

  async getAllLinksForBackup(): Promise<Link[]> {
    const client = getTursoClient();
    const { rows } = await client.execute('SELECT * FROM links ORDER BY created_at ASC');
    return rows as unknown as Link[];
  }

  async bulkInsertLinks(links: LinkInsert[]): Promise<{ success: boolean; count: number }> {
    const client = getTursoClient();

    // SQLite upsert: INSERT INTO ... ON CONFLICT(url) DO NOTHING
    const statements = links.map(link => {
      const id = crypto.randomUUID();
      const created_at = link.created_at || new Date().toISOString();
      const category = link.category || '🔗 #Link';
      const page_title = link.page_title || '';

      return {
        sql: `INSERT INTO links (id, title, page_title, url, category, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(url) DO NOTHING`,
        args: [id, link.title, page_title, link.url, category, created_at]
      };
    });

    // Run all inserts in a transaction using a batch, then report what actually landed:
    // ON CONFLICT DO NOTHING means the input length is not the inserted count.
    const results = await client.batch(statements, 'write');
    const inserted = results.reduce((sum, result) => sum + Number(result.rowsAffected ?? 0), 0);

    return { success: true, count: inserted };
  }
}
