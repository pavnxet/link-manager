import { createClient, Client } from '@libsql/client';
import { DbClient, Link, LinkInsert, LinkUpdate } from '../db';

let tursoClient: Client | null = null;

function getTursoClient() {
  if (!tursoClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Missing Turso environment variables');
      }
    }

    tursoClient = createClient({
      url: url || 'file:local.db',
      authToken: authToken,
    });
  }
  return tursoClient;
}

export class TursoDbClient implements DbClient {
  async getLinks(query?: string | null): Promise<Link[]> {
    const client = getTursoClient();
    let sql = 'SELECT * FROM links ORDER BY created_at DESC';
    let args: string[] = [];

    if (query) {
      sql = `
        SELECT * FROM links 
        WHERE title LIKE ? OR page_title LIKE ? OR url LIKE ? 
        ORDER BY created_at DESC
      `;
      const likeQuery = `%${query}%`;
      args = [likeQuery, likeQuery, likeQuery];
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

    await client.execute({ sql, args });

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
    try {
      // Find the maximum title that consists only of digits
      // GLOB '*[0-9]*' ensures it has digits, but to ensure it ONLY has digits in SQLite,
      // we check that CAST(title AS INTEGER) is not 0 for non-zero strings or similar tricks,
      // but a simple approach for SQLite without REGEXP:
      // Since `title` containing only digits will convert to an integer nicely, we can do:
      const { rows } = await client.execute({
        sql: `SELECT MAX(CAST(title AS INTEGER)) as maxId 
               FROM links 
               WHERE title = CAST(CAST(title AS INTEGER) AS TEXT)`
      });

      const maxId = rows[0]?.maxId;
      if (maxId === null || maxId === undefined) {
        return 1;
      }
      return (Number(maxId) || 0) + 1;
    } catch (error) {
      console.error('Error fetching next ID from Turso:', error);
      return 1;
    }
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

    // Run all inserts in a transaction using a batch
    await client.batch(statements, 'write');

    return { success: true, count: links.length };
  }
}
