import { getSupabase } from '../supabase';
import { DbClient, Link, LinkInsert, LinkUpdate } from '../db';

/** PostgREST treats these as filter syntax, so a search containing them produced a 500. */
function filterTerm(query: string): string {
  return query.replace(/[,()"\\]/g, ' ').trim()
}

export class SupabaseDbClient implements DbClient {
  async getLinks(query?: string | null): Promise<Link[]> {
    let dbQuery = getSupabase()
      .from('links')
      .select('*')
      .order('created_at', { ascending: false });

    if (query) {
      const term = filterTerm(query);
      if (term) {
        dbQuery = dbQuery.or(
          `title.ilike.%${term}%,page_title.ilike.%${term}%,category.ilike.%${term}%,url.ilike.%${term}%`,
        );
      }
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

    const { data, error } = await getSupabase()
      .from('links')
      .upsert(linksToInsert, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');

    if (error) {
      throw error;
    }

    // ignoreDuplicates skips rows that already exist, so the inserted count is what came back.
    return { success: true, count: data?.length ?? 0 };
  }
}
