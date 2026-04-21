import { Hono } from 'hono';
import type { Env, TelegramUpdate, Link } from './env';
import { getSupabase, checkAuthentication, authenticateUser, saveLink, deleteLink, getLinks, getLinkByDisplayNumber, getAllLinksForBackup, checkRateLimit, getStats } from './supabase';
import { 
  sendMessage, 
  answerCallbackQuery, 
  createSaveInlineKeyboard, 
  extractUrls, 
  fetchPageTitle,
  formatLinkMessage,
  formatHelpMessage,
  formatStatsMessage,
  escapeHtml
} from './telegram';

const app = new Hono<{ Bindings: Env }>();

// Webhook endpoint
app.post('/webhook', async (c) => {
  const env = c.env;
  
  try {
    const update: TelegramUpdate = await c.req.json();
    
    console.log('Received update:', JSON.stringify(update));

    const supabase = getSupabase(env);

    // Handle callback query (inline button clicks)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const userId = callback.from.id;
      const data = callback.data;

      // Check rate limit
      const rateLimit = await checkRateLimit(supabase, userId);
      if (!rateLimit.allowed) {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, '⚠️ Rate limit exceeded. Try again in a minute.', true);
        return c.json({ ok: true });
      }

      // Check authentication
      const isAuthenticated = await checkAuthentication(supabase, userId);
      if (!isAuthenticated) {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, '❌ Please authenticate first with /login', true);
        return c.json({ ok: true });
      }

      if (data === 'cancel') {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, 'Cancelled ❌');
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Save cancelled.');
        return c.json({ ok: true });
      }

      if (data.startsWith('save:')) {
        const parts = data.substring(5).split('|');
        const url = decodeURIComponent(parts[0]);
        const pageTitle = decodeURIComponent(parts[1]);
        const title = decodeURIComponent(parts[2]) || 'Untitled';

        const result = await saveLink(supabase, url, title, pageTitle, 'General', userId);

        if (result.success && result.link) {
          await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, `✅ Saved as #${result.link.id}`);
          await sendMessage(
            env.TELEGRAM_BOT_TOKEN, 
            chatId, 
            `✅ <b>Link Saved!</b>\n\n` +
            `🔗 <b>#${result.link.id}</b>\n` +
            `📄 ${escapeHtml(title)}\n` +
            `🌐 ${escapeHtml(pageTitle)}\n` +
            `🔗 <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`,
            { inline_keyboard: [[{ text: '🗑️ Delete', callback_data: `delete:${result.link.id}` }]] }
          );
        } else {
          await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, '❌ Failed to save', true);
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Error: ${result.error}`);
        }

        return c.json({ ok: true });
      }

      if (data.startsWith('delete:')) {
        const linkId = parseInt(data.substring(7));
        const result = await deleteLink(supabase, linkId, userId);

        if (result.success) {
          await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, `🗑️ Deleted #${linkId}`);
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `🗑️ Link #${linkId} has been deleted.`);
        } else {
          await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id, '❌ Failed to delete', true);
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Error: ${result.error}`);
        }

        return c.json({ ok: true });
      }

      if (data.startsWith('list:')) {
        const offset = parseInt(data.substring(5));
        const result = await getLinks(supabase, 20, offset, undefined, userId);

        if (result.success && result.links) {
          const hasMore = result.links.length === 20;
          let message = '📋 <b>Your Links</b>\n\n';

          if (result.links.length === 0) {
            message += 'No links found.';
          } else {
            for (const link of result.links) {
              message += `🔗 <b>#${link.id}</b> - ${escapeHtml(link.title)}\n`;
              message += `<a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a>\n\n`;
            }
          }

          const replyMarkup = offset > 0 || hasMore ? 
            { inline_keyboard: [
              [
                ...(offset > 0 ? [{ text: '⬅️ Previous', callback_data: `list:${offset - 20}` }] : []),
                ...(hasMore ? [{ text: 'Next ➡️', callback_data: `list:${offset + 20}` }] : [])
              ]
            ]} : undefined;

          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, message, replyMarkup);
        }

        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callback.id);
        return c.json({ ok: true });
      }

      return c.json({ ok: true });
    }

    // Handle regular messages
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from?.id || 0;
      const username = message.from?.username || 'unknown';
      const text = message.text || '';

      // Check rate limit
      const rateLimit = await checkRateLimit(supabase, userId);
      if (!rateLimit.allowed) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '⚠️ Rate limit exceeded. Try again in a minute.');
        return c.json({ ok: true });
      }

      // Check if message contains a URL (auto-detect for saving)
      const urls = extractUrls(text);
      
      // If message contains URL and is not a command, ask to save
      if (urls.length > 0 && !text.startsWith('/')) {
        const isAuthenticated = await checkAuthentication(supabase, userId);
        if (!isAuthenticated) {
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Please authenticate first with /login <username> <password>');
          return c.json({ ok: true });
        }

        const url = urls[0]; // Take first URL
        
        // Validate URL before fetching
        if (!isValidUrl(url)) {
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Invalid URL format.');
          return c.json({ ok: true });
        }

        const pageTitle = await fetchPageTitle(url);
        const defaultTitle = pageTitle !== 'Untitled' ? pageTitle : url;

        const replyMarkup = createSaveInlineKeyboard(url, pageTitle, defaultTitle);
        
        await sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `🔗 <b>Found a link!</b>\n\n` +
          `📄 <b>Title:</b> ${escapeHtml(defaultTitle)}\n` +
          `🌐 <b>Page:</b> ${escapeHtml(pageTitle)}\n` +
          `🔗 <b>URL:</b> <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>\n\n` +
          `Do you want to save this?`,
          replyMarkup
        );

        return c.json({ ok: true });
      }

      // Handle commands
      if (text.startsWith('/')) {
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();

        switch (command) {
          case '/start':
          case '/help':
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, formatHelpMessage());
            break;

          case '/login':
            if (parts.length < 3) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Usage: /login <username> <password>');
              break;
            }

            const loginUsername = parts[1];
            const loginPassword = parts[2];

            // Verify admin credentials (passed to function for secure comparison)
            const authResult = await authenticateUser(supabase, userId, username, loginUsername, loginPassword, env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, authResult.message);
            break;

          case '/list':
            const isAuthList = await checkAuthentication(supabase, userId);
            if (!isAuthList) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Please authenticate first with /login');
              break;
            }

            const searchQuery = parts.slice(1).join(' ') || undefined;
            const listResult = await getLinks(supabase, 20, 0, searchQuery, userId);

            if (listResult.success && listResult.links) {
              let message = searchQuery 
                ? `🔍 <b>Search Results for "${escapeHtml(searchQuery)}"</b>\n\n`
                : `📋 <b>Your Latest Links</b>\n\n`;

              if (listResult.links.length === 0) {
                message += 'No links found.';
              } else {
                for (const link of listResult.links) {
                  message += `🔗 <b>#${link.id}</b> - ${escapeHtml(link.title)}\n`;
                  message += `<a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a>\n\n`;
                }
              }

              const hasMore = listResult.links.length === 20;
              const replyMarkup = hasMore ? 
                { inline_keyboard: [[{ text: 'Next ➡️', callback_data: 'list:20' }]]} : undefined;

              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, message, replyMarkup);
            } else {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Error: ${listResult.error}`);
            }
            break;

          case '/delete':
            const isAuthDelete = await checkAuthentication(supabase, userId);
            if (!isAuthDelete) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Please authenticate first with /login');
              break;
            }

            if (parts.length < 2) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Usage: /delete <number>');
              break;
            }

            const displayNum = parseInt(parts[1]);
            if (isNaN(displayNum)) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Please provide a valid number.');
              break;
            }

            const linkToDelete = await getLinkByDisplayNumber(supabase, displayNum, userId);
            if (linkToDelete.success && linkToDelete.link) {
              const confirmMarkup = { 
                inline_keyboard: [[
                  { text: '🗑️ Yes, Delete', callback_data: `delete:${displayNum}` },
                  { text: '❌ Cancel', callback_data: 'cancel' }
                ]]
              };
              await sendMessage(
                env.TELEGRAM_BOT_TOKEN,
                chatId,
                `Are you sure you want to delete link #${displayNum}?\n\n${formatLinkMessage(linkToDelete.link)}`,
                confirmMarkup
              );
            } else {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Link #${displayNum} not found.`);
            }
            break;

          case '/backup':
            const isAuthBackup = await checkAuthentication(supabase, userId);
            if (!isAuthBackup) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Please authenticate first with /login');
              break;
            }

            const backupResult = await getAllLinksForBackup(supabase, userId);
            if (backupResult.success && backupResult.links) {
              const jsonData = JSON.stringify(backupResult.links, null, 2);
              const fileName = `link-vault-backup-${new Date().toISOString().split('T')[0]}.json`;
              
              // Send as file
              const formData = new FormData();
              formData.append('chat_id', chatId.toString());
              formData.append('document', new Blob([jsonData], { type: 'application/json' }), fileName);
              formData.append('caption', `📦 Backup of ${backupResult.links.length} links`);

              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
                method: 'POST',
                body: formData
              });
            } else {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Error: ${backupResult.error}`);
            }
            break;

          case '/stats':
            const isAuthStats = await checkAuthentication(supabase, userId);
            if (!isAuthStats) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Please authenticate first with /login');
              break;
            }

            const stats = await getStats(supabase, userId);
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, formatStatsMessage(stats.totalLinks, stats.totalUsers));
            break;

          default:
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❓ Unknown command. Use /help to see available commands.');
        }
      }
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return error to Telegram so it can retry
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// URL validation helper - prevents SSRF
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    
    // Block private IP ranges to prevent SSRF
    const hostname = url.hostname;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (ipPattern.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      // Check for private IPs: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x
      if (parts[0] === 10 || 
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 127)) {
        return false;
      }
    }
    
    // Block localhost
    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export default app;
