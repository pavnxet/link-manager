import { supabase } from '@/lib/supabase'
import { DatabaseAdapter, Link, CreateLinkInput, UpdateLinkInput } from './types'

export class SupabaseAdapter implements DatabaseAdapter {
  async getLinks(query?: string): Promise<Link[]> {
    let dbQuery = supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: false })

    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,page_title.ilike.%${query}%,url.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery
    if (error) throw error
    return data as Link[]
  }

  async createLink(input: CreateLinkInput): Promise<Link> {
    const { data, error } = await supabase
      .from('links')
      .insert([
        {
          title: input.title,
          page_title: input.page_title || '',
          url: input.url,
          category: input.category || '🔗 #Link',
        },
      ])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        const conflictError = new Error('URL already exists')
        ;(conflictError as any).code = '23505'
        throw conflictError
      }
      throw error
    }
    return data as Link
  }

  async updateLink(id: string, input: UpdateLinkInput): Promise<void> {
    const { error } = await supabase
      .from('links')
      .update(input)
      .eq('id', id)

    if (error) throw error
  }

  async deleteLink(id: string): Promise<void> {
    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getNextId(): Promise<number> {
    const { data: maxId, error } = await supabase.rpc('get_max_numeric_id')
    if (error) {
      console.error('Error fetching next ID via RPC:', error)
      return 1
    }
    return (maxId || 0) + 1
  }

  async exportLinks(): Promise<Link[]> {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    return data as Link[]
  }

  async importLinks(links: Partial<Link>[]): Promise<{ success: boolean; count: number }> {
    const linksToInsert = links.map((link) => ({
      title: link.title,
      page_title: link.page_title,
      url: link.url,
      category: link.category,
      created_at: link.created_at || new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('links')
      .upsert(linksToInsert, { onConflict: 'url', ignoreDuplicates: true })
      .select()

    if (error) throw error
    return { success: true, count: data?.length || 0 }
  }
}
