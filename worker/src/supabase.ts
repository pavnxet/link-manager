import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env, Link, BotSession } from './env';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(env: Env): SupabaseClient {
  if (!supabaseInstance) {
    // Using SUPABASE_SERVICE_ROLE_KEY (sb_secret_...) for server-side operations
    // This key is safe to use in Cloudflare Workers as it never exposes to clients
    supabaseInstance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseInstance;
}

export async function checkAuthentication(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from('bot_sessions')
    .select('is_authenticated')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.is_authenticated === true;
}

export async function getUserInfo(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<{ userId: string | null; isAuthenticated: boolean }> {
  const { data, error } = await supabase
    .from('bot_sessions')
    .select('is_authenticated')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (error || !data || !data.is_authenticated) {
    return { userId: null, isAuthenticated: false };
  }

  // For now, we use a single admin user. In future, could support multi-user
  // Fetch the admin user ID from bot_users table
  const { data: adminData } = await supabase
    .from('bot_users')
    .select('id')
    .limit(1)
    .single();

  return { 
    userId: adminData?.id || null, 
    isAuthenticated: true 
  };
}

export async function authenticateUser(
  supabase: SupabaseClient,
  telegramUserId: number,
  username: string,
  adminUsername: string,
  adminPassword: string,
  envAdminUsername: string,
  envAdminPassword: string
): Promise<{ success: boolean; message: string }> {
  // Verify credentials against environment variables (secure comparison)
  // Use timing-safe comparison to prevent timing attacks
  const credsMatch = 
    adminUsername.length === envAdminUsername.length &&
    adminPassword.length === envAdminPassword.length &&
    constantTimeCompare(adminUsername, envAdminUsername) &&
    constantTimeCompare(adminPassword, envAdminPassword);

  if (!credsMatch) {
    return { success: false, message: '❌ Invalid credentials!' };
  }

  // Check if user exists
  const { data: existingSession } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (existingSession) {
    // Update session
    const { error } = await supabase
      .from('bot_sessions')
      .update({
        is_authenticated: true,
        last_active: new Date().toISOString(),
        telegram_username: username
      })
      .eq('telegram_user_id', telegramUserId);

    if (error) {
      return { success: false, message: 'Failed to update session' };
    }
    return { success: true, message: '✅ Successfully authenticated!' };
  } else {
    // Create new session
    const { error } = await supabase.from('bot_sessions').insert({
      telegram_user_id: telegramUserId,
      telegram_username: username,
      is_authenticated: true,
      last_active: new Date().toISOString()
    });

    if (error) {
      return { success: false, message: 'Failed to create session' };
    }
    return { success: true, message: '✅ Successfully authenticated!' };
  }
}

// Timing-safe string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function saveLink(
  supabase: SupabaseClient,
  url: string,
  title: string,
  pageTitle: string | undefined,
  category: string | undefined,
  telegramUserId: number
): Promise<{ success: boolean; link?: Link; error?: string }> {
  try {
    // Get user info to ensure authentication and get user_id
    const userInfo = await getUserInfo(supabase, telegramUserId);
    
    if (!userInfo.isAuthenticated || !userInfo.userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if URL already exists for this user
    const { data: existingLink } = await supabase
      .from('links')
      .select('id')
      .eq('url', url)
      .eq('user_id', userInfo.userId)
      .single();

    if (existingLink) {
      return { success: false, error: 'This URL already exists in your vault!' };
    }

    const { data, error } = await supabase
      .from('links')
      .insert({
        url,
        title,
        page_title: pageTitle,
        category: category || 'General',
        user_id: userInfo.userId,
        telegram_user_id: telegramUserId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return { success: false, error: 'This URL already exists in the vault!' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, link: data as Link };
  } catch (e) {
    console.error('Save link error:', e);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteLink(
  supabase: SupabaseClient,
  displayNumber: number,
  telegramUserId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user info to ensure proper authorization
    const userInfo = await getUserInfo(supabase, telegramUserId);
    
    if (!userInfo.isAuthenticated || !userInfo.userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // First verify the link belongs to this user
    const { data: link } = await supabase
      .from('links')
      .select('id')
      .eq('id', displayNumber)
      .eq('user_id', userInfo.userId)
      .single();

    if (!link) {
      return { success: false, error: 'Link not found or you do not have permission to delete it' };
    }

    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', displayNumber)
      .eq('user_id', userInfo.userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Delete link error:', e);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getLinks(
  supabase: SupabaseClient,
  limit: number = 20,
  offset: number = 0,
  searchQuery?: string,
  telegramUserId?: number
): Promise<{ success: boolean; links?: Link[]; error?: string }> {
  try {
    // Get user info to scope results
    let query = supabase
      .from('links')
      .select('*');

    // If telegramUserId provided, filter by user
    if (telegramUserId) {
      const userInfo = await getUserInfo(supabase, telegramUserId);
      if (userInfo.isAuthenticated && userInfo.userId) {
        query = query.eq('user_id', userInfo.userId);
      } else {
        return { success: false, error: 'Not authenticated' };
      }
    }

    query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,url.ilike.%${searchQuery}%,page_title.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, links: data as Link[] };
  } catch (e) {
    console.error('Get links error:', e);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getLinkByDisplayNumber(
  supabase: SupabaseClient,
  displayNumber: number,
  telegramUserId: number
): Promise<{ success: boolean; link?: Link | null; error?: string }> {
  try {
    const userInfo = await getUserInfo(supabase, telegramUserId);
    
    if (!userInfo.isAuthenticated || !userInfo.userId) {
      return { success: false, error: 'Not authenticated', link: null };
    }

    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('id', displayNumber)
      .eq('user_id', userInfo.userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      return { success: false, error: error.message };
    }

    return { success: true, link: data as Link | null };
  } catch (e) {
    console.error('Get link error:', e);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getAllLinksForBackup(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<{ success: boolean; links?: Link[]; error?: string }> {
  try {
    const userInfo = await getUserInfo(supabase, telegramUserId);
    
    if (!userInfo.isAuthenticated || !userInfo.userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', userInfo.userId)
      .order('id', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, links: data as Link[] };
  } catch (e) {
    console.error('Backup error:', e);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date().toISOString();
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  try {
    // Clean up old entries first (fire and forget)
    supabase.rpc('cleanup_old_rate_limits').then(() => {});

    const { data } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('telegram_user_id', telegramUserId)
      .gte('window_start', oneMinuteAgo)
      .single();

    if (!data) {
      // First request in this window - use upsert to avoid race condition
      await supabase.from('rate_limits').upsert({
        telegram_user_id: telegramUserId,
        count: 1,
        window_start: now
      }, {
        onConflict: 'telegram_user_id,window_start'
      });
      return { allowed: true, remaining: 9 };
    }

    if (data.count >= 10) {
      return { allowed: false, remaining: 0 };
    }

    // Increment counter atomically
    await supabase.rpc('increment_rate_limit', {
      p_telegram_user_id: telegramUserId,
      p_window_start: oneMinuteAgo
    });

    return { allowed: true, remaining: 10 - (data.count + 1) };
  } catch (e) {
    console.error('Rate limit error:', e);
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: 10 };
  }
}

export async function getStats(supabase: SupabaseClient, telegramUserId: number): Promise<{ totalLinks: number; totalUsers: number }> {
  try {
    const userInfo = await getUserInfo(supabase, telegramUserId);
    
    if (!userInfo.isAuthenticated || !userInfo.userId) {
      return { totalLinks: 0, totalUsers: 0 };
    }

    // Get user's link count
    const { count: linkCount } = await supabase
      .from('links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userInfo.userId);

    // Get total authenticated users
    const { count: userCount } = await supabase
      .from('bot_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_authenticated', true);

    return {
      totalLinks: linkCount || 0,
      totalUsers: userCount || 0
    };
  } catch (e) {
    console.error('Stats error:', e);
    return { totalLinks: 0, totalUsers: 0 };
  }
}
