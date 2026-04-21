import type { Env, TelegramMessage, TelegramCallbackQuery } from './env';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      })
    });

    const data: any = await response.json();
    return data.ok === true;
  } catch (e) {
    console.error('Failed to send message:', e);
    return false;
  }
}

export async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      })
    });

    const data: any = await response.json();
    return data.ok === true;
  } catch (e) {
    console.error('Failed to edit message:', e);
    return false;
  }
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
        show_alert: showAlert
      })
    });

    const data: any = await response.json();
    return data.ok === true;
  } catch (e) {
    console.error('Failed to answer callback query:', e);
    return false;
  }
}

export async function deleteMessage(
  botToken: string,
  chatId: number,
  messageId: number
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });

    const data: any = await response.json();
    return data.ok === true;
  } catch (e) {
    console.error('Failed to delete message:', e);
    return false;
  }
}

export function createSaveInlineKeyboard(url: string, pageTitle: string, title: string): any {
  return {
    inline_keyboard: [
      [
        { text: '✅ Save', callback_data: `save:${encodeURIComponent(url)}|${encodeURIComponent(pageTitle)}|${encodeURIComponent(title)}` },
        { text: '❌ Cancel', callback_data: 'cancel' }
      ]
    ]
  };
}

export function createDeleteInlineKeyboard(displayNumber: number): any {
  return {
    inline_keyboard: [
      [
        { text: '🗑️ Delete', callback_data: `delete:${displayNumber}` }
      ]
    ]
  };
}

export function createPaginationInlineKeyboard(offset: number, hasMore: boolean): any {
  const keyboard: any[] = [];
  const row: any[] = [];

  if (offset > 0) {
    row.push({ text: '⬅️ Previous', callback_data: `list:${offset - 20}` });
  }

  if (hasMore) {
    row.push({ text: 'Next ➡️', callback_data: `list:${offset + 20}` });
  }

  if (row.length > 0) {
    keyboard.push(row);
  }

  return { inline_keyboard: keyboard };
}

// URL regex pattern
export const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : []; // Remove duplicates
}

export async function fetchPageTitle(url: string): Promise<string> {
  try {
    // Use a simple fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkVaultBot/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return 'Untitled';
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim().substring(0, 100);
    }

    return 'Untitled';
  } catch (e) {
    return 'Untitled';
  }
}

export function formatLinkMessage(link: any): string {
  return `🔗 <b>#${link.id}</b>\n` +
    `<b>Title:</b> ${escapeHtml(link.title)}\n` +
    `<b>Page:</b> ${escapeHtml(link.page_title || 'N/A')}\n` +
    `<b>URL:</b> <a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a>\n` +
    `<b>Category:</b> ${escapeHtml(link.category || 'General')}\n` +
    `<b>Added:</b> ${new Date(link.created_at).toLocaleDateString()}`;
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatHelpMessage(): string {
  return `🤖 <b>Link Vault Bot Commands</b>\n\n` +
    `🔐 <b>/login &lt;username&gt; &lt;password&gt;</b> - Authenticate as admin\n\n` +
    `📥 <b>Send any link</b> - Bot will ask to save it\n\n` +
    `📋 <b>/list [query]</b> - List saved links (optional search)\n\n` +
    `🗑️ <b>/delete &lt;number&gt;</b> - Delete link by number\n\n` +
    `💾 <b>/backup</b> - Export all links as JSON\n\n` +
    `📊 <b>/stats</b> - Show statistics\n\n` +
    `❓ <b>/help</b> - Show this help message\n\n` +
    `💡 <b>Tip:</b> Just send me any URL and I'll ask if you want to save it!`;
}

export function formatStatsMessage(totalLinks: number, totalUsers: number): string {
  return `📊 <b>Link Vault Statistics</b>\n\n` +
    `🔗 Total Links: <b>${totalLinks}</b>\n` +
    `👥 Total Users: <b>${totalUsers}</b>\n\n` +
    `Keep building your vault! 🚀`;
}
