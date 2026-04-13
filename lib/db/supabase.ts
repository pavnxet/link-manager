import { getSupabase } from '../supabase';
import { DbClient, Link, LinkInsert, LinkUpdate } from '../db';

export class SupabaseDbClient implements DbClient {
  async getLinks(query?: string | null): Promise<Link[]> {
    let dbQuery = getSupabase()
      .from('links')
      .select('*')
      .order('created_at', { ascending: false });

    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,page_title.ilike.%${query}%,url.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw error;
    }

    return data as Link[];
  }

  async getLinkById(id: string): Promise<Link | null> {
    const { data, error } = await getSupabase()
      .from('links')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // not found
         return null;
      }
      throw error;
    }

    return data as Link;
  }

  async addLink(link: LinkInsert): Promise<Link> {
    const { data, error } = await getSupabase()
      .from('links')
      .insert([
        {
          title: link.title,
          page_title: link.page_title || '',
          url: link.url,
          category: link.category || '🔗 #Link',
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Link;
  }

  async updateLink(id: string, link: LinkUpdate): Promise<Link> {
    const { data, error } = await getSupabase()
      .from('links')
      .update(link)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Link;
  }

  async deleteLink(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('links')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getNextNumericId(): Promise<number> {
    const { data: maxId, error } = await getSupabase().rpc('get_max_numeric_id');

    if (error) {
      console.error('Error fetching next ID via RPC:', error);
      return 1;
    }

    return (maxId || 0) + 1;
  }

  async getAllLinksForBackup(): Promise<Link[]> {
    const { data, error } = await getSupabase()
      .from('links')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Link[];
  }

  async bulkInsertLinks(links: LinkInsert[]): Promise<{ success: boolean; count: number }> {
    const linksToInsert = links.map(link => ({
      title: link.title,
      page_title: link.page_title,
      url: link.url,
      category: link.category,
      created_at: link.created_at || new Date().toISOString(),
    }));

    const { error } = await getSupabase()
      .from('links')
      .upsert(linksToInsert, { onConflict: 'url', ignoreDuplicates: true });

    if (error) {
      throw error;
    }

    return { success: true, count: linksToInsert.length };
  }
}
