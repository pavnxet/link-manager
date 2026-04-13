import { createClient, Client } from '@libsql/client'
import { DatabaseAdapter, Link, CreateLinkInput, UpdateLinkInput } from './types'
import { v4 as uuidv4 } from 'uuid'

export class TursoAdapter implements DatabaseAdapter {
  private client: Client

  constructor() {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN

    if (!url) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Missing TURSO_DATABASE_URL environment variable')
      }
    }

    this.client = createClient({
      url: url || '',
      authToken: authToken,
    })
  }

  async getLinks(query?: string): Promise<Link[]> {
    let sql = 'SELECT * FROM links ORDER BY created_at DESC'
    let args: any[] = []

    if (query) {
      sql = `
        SELECT * FROM links 
        WHERE title LIKE ? OR page_title LIKE ? OR url LIKE ? 
        ORDER BY created_at DESC
      `
      const searchPattern = `%${query}%`
      args = [searchPattern, searchPattern, searchPattern]
    }

    const result = await this.client.execute({ sql, args })
    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      page_title: row.page_title as string,
      url: row.url as string,
      category: row.category as string,
      created_at: row.created_at as string,
    }))
  }

  async createLink(input: CreateLinkInput): Promise<Link> {
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    const pageTitle = input.page_title || ''
    const category = input.category || '🔗 #Link'

    try {
      await this.client.execute({
        sql: 'INSERT INTO links (id, title, page_title, url, category, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, input.title, pageTitle, input.url, category, createdAt]
      })

      return {
        id,
        title: input.title,
        page_title: pageTitle,
        url: input.url,
        category,
        created_at: createdAt
      }
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed: links.url')) {
        const conflictError = new Error('URL already exists')
        ;(conflictError as any).code = '23505'
        throw conflictError
      }
      throw error
    }
  }

  async updateLink(id: string, input: UpdateLinkInput): Promise<void> {
    const sets: string[] = []
    const args: any[] = []

    if (input.title !== undefined) {
      sets.push('title = ?')
      args.push(input.title)
    }
    if (input.page_title !== undefined) {
      sets.push('page_title = ?')
      args.push(input.page_title)
    }
    if (input.url !== undefined) {
      sets.push('url = ?')
      args.push(input.url)
    }
    if (input.category !== undefined) {
      sets.push('category = ?')
      args.push(input.category)
    }

    if (sets.length === 0) return

    args.push(id)
    await this.client.execute({
      sql: `UPDATE links SET ${sets.join(', ')} WHERE id = ?`,
      args
    })
  }

  async deleteLink(id: string): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM links WHERE id = ?',
      args: [id]
    })
  }

  async getNextId(): Promise<number> {
    const result = await this.client.execute(`
      SELECT MAX(CAST(title AS INTEGER)) as maxId 
      FROM links 
      WHERE title GLOB '[0-9]*'
    `)
    const maxId = result.rows[0]?.maxId as number | null
    return (maxId || 0) + 1
  }

  async exportLinks(): Promise<Link[]> {
    const result = await this.client.execute('SELECT * FROM links ORDER BY created_at ASC')
    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      page_title: row.page_title as string,
      url: row.url as string,
      category: row.category as string,
      created_at: row.created_at as string,
    }))
  }

  async importLinks(links: Partial<Link>[]): Promise<{ success: boolean; count: number }> {
    // In SQLite, we can use INSERT OR IGNORE for upsert-like behavior on conflict
    const batchSize = 50
    let totalImported = 0

    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize)
      let batchImported = 0
      
      for (const link of batch) {
        const result = await this.client.execute({
          sql: `INSERT OR IGNORE INTO links (id, title, page_title, url, category, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            link.id || uuidv4(),
            link.title || '',
            link.page_title || '',
            link.url || '',
            link.category || '🔗 #Link',
            link.created_at || new Date().toISOString()
          ]
        })
        if (result.rowsAffected > 0) {
          batchImported++
        }
      }
      totalImported += batchImported
    }

    return { success: true, count: totalImported }
  }
}
