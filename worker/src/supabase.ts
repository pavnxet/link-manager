import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Link = {
  id: string
  title: string
  page_title: string | null
  url: string
  category: string | null
  created_at: string
}

export type LinkInsert = {
  title: string
  page_title?: string
  url: string
  category?: string
  created_at?: string
}

export type LinkUpdate = {
  title?: string
  page_title?: string
  url?: string
  category?: string
}

export type WorkerEnv = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export class SupabaseRepository {
  private readonly client: SupabaseClient

  constructor(env: WorkerEnv) {
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  }

  async getLinks(query?: string): Promise<Link[]> {
    let q = this.client.from('links').select('*').order('created_at', { ascending: false })
    if (query) {
      q = q.or(`title.ilike.%${query}%,page_title.ilike.%${query}%,url.ilike.%${query}%,category.ilike.%${query}%`)
    }
    const { data, error } = await q
    if (error) throw error
    return data as Link[]
  }

  async getLinkById(id: string): Promise<Link | null> {
    const { data, error } = await this.client.from('links').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return (data as Link | null) || null
  }

  async addLink(input: LinkInsert): Promise<Link> {
    const payload = {
      title: input.title,
      page_title: input.page_title ?? '',
      url: input.url,
      category: input.category ?? '🔗 #Link',
      created_at: input.created_at,
    }

    const { data, error } = await this.client.from('links').insert([payload]).select('*').single()
    if (error) throw error
    return data as Link
  }

  async updateLink(id: string, patch: LinkUpdate): Promise<Link> {
    const { data, error } = await this.client.from('links').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    return data as Link
  }

  async deleteLink(id: string): Promise<void> {
    const { error } = await this.client.from('links').delete().eq('id', id)
    if (error) throw error
  }

  async getNextNumericId(): Promise<number> {
    const { data, error } = await this.client.rpc('get_max_numeric_id')
    if (error) throw error
    return (data || 0) + 1
  }

  async getAllLinksForBackup(): Promise<Link[]> {
    const { data, error } = await this.client.from('links').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return data as Link[]
  }

  async bulkInsertLinks(links: LinkInsert[]): Promise<{ success: boolean; count: number }> {
    const payload = links.map((link) => ({
      title: link.title,
      page_title: link.page_title ?? '',
      url: link.url,
      category: link.category ?? '🔗 #Link',
      created_at: link.created_at ?? new Date().toISOString(),
    }))

    const { error } = await this.client.from('links').upsert(payload, { onConflict: 'url', ignoreDuplicates: true })
    if (error) throw error

    return { success: true, count: payload.length }
  }
}
