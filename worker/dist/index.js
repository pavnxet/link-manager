// Link Vault Telegram Bot - Bundled for Cloudflare Workers Dashboard
// Generated from TypeScript sources. Ready to copy-paste into Cloudflare Dashboard.
// NOTE: This is a self-contained JavaScript file with all dependencies inlined.

// ==========================================
// 1. DEPENDENCIES (Inlined HTML Parser)
// ==========================================

const parseHTML = (function() {
  function Node(tag, rawAttrs, attrs, parent) {
    this.tag = tag;
    this.rawAttrs = rawAttrs || '';
    this.parent = parent || null;
    this.childNodes = [];
    this.attrs = attrs || {};
  }
  Node.prototype.toString = function() {
    if (this.tag === '#text') return this.textContent;
    if (this.tag === '#comment') return '<!--' + this.textContent + '-->';
    let attrs = '';
    for (let key in this.attrs) {
      if (this.attrs.hasOwnProperty(key)) {
        let val = this.attrs[key];
        attrs += ' ' + key + (val !== '' ? '="' + val + '"' : '');
      }
    }
    if (this.childNodes.length === 0) {
      if (this.rawAttrs.match(/\/$/)) return '<' + this.tag + attrs + '/>';
      return '<' + this.tag + attrs + '></' + this.tag + '>';
    }
    return '<' + this.tag + attrs + '>' + this.childNodes.map(c => c.toString()).join('') + '</' + this.tag + '>';
  };
  Object.defineProperty(Node.prototype, 'textContent', {
    get: function() {
      if (this.tag === '#text') return this.rawText || '';
      if (this.tag === '#comment') return this.rawText || '';
      return this.childNodes.map(c => c.textContent).join('');
    },
    set: function(val) {
      if (this.tag === '#text') this.rawText = val;
    }
  });
  Object.defineProperty(Node.prototype, 'innerText', {
    get: function() { return this.textContent.replace(/\n\s*/g, '\n').trim(); }
  });
  Object.defineProperty(Node.prototype, 'innerHTML', {
    get: function() { return this.childNodes.map(c => c.toString()).join(''); }
  });
  Node.prototype.querySelector = function(sel) {
    let els = this.querySelectorAll(sel);
    return els.length > 0 ? els[0] : null;
  };
  Node.prototype.querySelectorAll = function(sel) {
    if (!sel || typeof sel !== 'string') return [];
    let matcher = function(el, selector) {
      if (!el.tag || el.tag === '#text' || el.tag === '#comment') return false;
      let tag = el.tag;
      let id = el.attrs.id;
      let classes = el.attrs.class ? el.attrs.class.split(/\s+/) : [];
      
      let s = selector.trim().split(/\s+/);
      let current = s[0];
      let rest = s.slice(1).join(' ');
      
      let matchTag = current === '*' || current === tag;
      let matchId = false;
      let matchClass = false;
      
      if (current.startsWith('#')) {
        let reqId = current.substring(1);
        matchId = (id === reqId);
        matchTag = true;
      } else if (current.startsWith('.')) {
        let reqClass = current.substring(1);
        matchClass = classes.includes(reqClass);
        matchTag = true;
      }
      
      if (matchTag && (matchId || matchClass || (!current.startsWith('#') && !current.startsWith('.')))) {
        if (!rest) return true;
        for (let i=0; i<el.childNodes.length; i++) {
          if (matcher(el.childNodes[i], rest)) return true;
        }
        return false;
      }
      return false;
    };

    let results = [];
    let traverse = function(node) {
      if (matcher(node, sel)) results.push(node);
      if (node.childNodes) {
        for (let i=0; i<node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
      }
    };
    traverse(this);
    return results;
  };

  function parse(str, options) {
    options = options || {};
    let root = new Node('#root');
    
    // Simplified regex-based parser for title/meta
    let titleMatch = str.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      let titleNode = new Node('title');
      titleNode.rawText = titleMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
      root.childNodes.push(titleNode);
    }
    
    let metaDesc = str.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    if (!metaDesc) metaDesc = str.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    if (metaDesc) {
      let metaNode = new Node('meta');
      metaNode.attrs = { name: 'description', content: metaDesc[1] };
      root.childNodes.push(metaNode);
    }

    if (!titleMatch) {
      let h1Match = str.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
         let h1Node = new Node('h1');
         h1Node.rawText = h1Match[1].replace(/<[^>]*>/g, '').trim();
         root.childNodes.push(h1Node);
      }
    }
    
    return root;
  }
  return parse;
})();

// ==========================================
// 2. UTILITIES & SSRF PROTECTION
// ==========================================

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const validateUrlSafety = async (urlStr) => {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP/HTTPS allowed' };
    }
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
      return { safe: false, reason: 'Internal domains not allowed' };
    }
    return { safe: true };
  } catch (e) {
    return { safe: false, reason: 'Invalid URL format' };
  }
};

const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ==========================================
// 3. SUPABASE CLIENT (Minimal Implementation)
// ==========================================

class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'Authorization': `Bearer ${key}`,
      'apikey': key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  from(table) {
    return new SupabaseQuery(this, table);
  }
}

class SupabaseQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.selectCols = '*';
    this.limitVal = null;
    this.orderCol = null;
    this.orderAsc = true;
  }

  select(cols) {
    this.selectCols = cols;
    return this;
  }

  eq(col, val) {
    this.filters.push(`${col}=eq.${val}`);
    return this;
  }
  
  neq(col, val) {
    this.filters.push(`${col}=neq.${val}`);
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orderCol = col;
    this.orderAsc = ascending;
    return this;
  }

  limit(count) {
    this.limitVal = count;
    return this;
  }

  async maybeSingle() {
    const res = await this.fetch();
    if (Array.isArray(res) && res.length > 0) return { data: res[0], error: null };
    if (Array.isArray(res)) return { data: null, error: null };
    return { data: res, error: null };
  }

  async single() {
    const res = await this.fetch();
    if (Array.isArray(res) && res.length === 0) return { data: null, error: { message: 'Not found' } };
    return { data: Array.isArray(res) ? res[0] : res, error: null };
  }

  async fetch() {
    let url = `${this.client.url}/rest/v1/${this.table}?select=${this.selectCols}`;
    
    if (this.orderCol) {
      url += `&order=${this.orderCol}.${this.orderAsc ? 'asc' : 'desc'}`;
    }
    if (this.limitVal) {
      url += `&limit=${this.limitVal}`;
    }
    
    this.filters.forEach(f => url += `&${f}`);

    const res = await fetch(url, { headers: this.client.headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DB Error: ${res.status} ${err}`);
    }
    return res.json();
  }
  
  async insert(row) {
    const res = await fetch(`${this.client.url}/rest/v1/${this.table}`, {
      method: 'POST',
      headers: this.client.headers,
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 409) return { data: null, error: { message: 'Link already exists' } };
      throw new Error(`Insert Error: ${err}`);
    }
    const json = await res.json();
    return { data: Array.isArray(json) ? json[0] : json, error: null };
  }
  
  async update(row) {
    let url = `${this.client.url}/rest/v1/${this.table}`;
    this.filters.forEach(f => url += `&${f}`);
    
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.client.headers,
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(`Update Error: ${res.statusText}`);
    const json = await res.json();
    return { data: Array.isArray(json) ? json[0] : json, error: null };
  }
  
  async delete() {
    let url = `${this.client.url}/rest/v1/${this.table}`;
    this.filters.forEach(f => url += `&${f}`);
    
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.client.headers
    });
    if (!res.ok) throw new Error(`Delete Error: ${res.statusText}`);
    return { data: true, error: null };
  }
}

// ==========================================
// 4. TELEGRAM HELPERS
// ==========================================

const createInlineKeyboard = (linkId, userId) => {
  return {
    inline_keyboard: [[
      { text: '✅ Save', callback_data: `save_${linkId}_${userId}` },
      { text: '❌ Cancel', callback_data: `cancel_${linkId}_${userId}` }
    ]]
  };
};

const sendMessage = async (token, chatId, text, replyMarkup = null, parseMode = 'HTML') => {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: parseMode
  };
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
};

const answerCallback = async (token, callbackQueryId, text = null, showAlert = false) => {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  const body = { callback_query_id: callbackQueryId, show_alert: showAlert };
  if (text) body.text = text;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
};

const editMessageText = async (token, chatId, messageId, text, replyMarkup = null) => {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup);
  else body.reply_markup = JSON.stringify({ remove_keyboard: true });
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
};

// ==========================================
// 5. MAIN HANDLER
// ==========================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    try {
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const update = await request.json();
        await handleUpdate(update, env);
        return new Response('OK', { status: 200 });
      }
      
      if (url.pathname === '/') {
        return new Response('Link Vault Bot is running! 🚀\nSet your webhook to /webhook', { 
          headers: { 'Content-Type': 'text/plain' } 
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (e) {
      console.error('Worker Error:', e);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

async function handleUpdate(update, env) {
  const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  
  // Handle Callback Query (Button Clicks)
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const data = cb.data;
    
    const [action, linkIdStr, targetUserStr] = data.split('_');
    const targetUserId = parseInt(targetUserStr);
    
    if (userId !== targetUserId) {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, cb.id, '⛔ This button is not for you.', true);
      return;
    }

    if (action === 'save') {
      const draftId = linkIdStr;
      const { data: draft, error } = await db.from('links').select('*').eq('id', draftId).eq('telegram_user_id', userId).single();
      
      if (error || !draft) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, cb.id, '⚠️ Session expired or link invalid.', true);
        await editMessageText(env.TELEGRAM_BOT_TOKEN, chatId, messageId, '⚠️ This link request has expired.');
        return;
      }
      
      const { error: updateErr } = await db.from('links').update({ is_draft: false }).eq('id', draftId);
      
      if (updateErr) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, cb.id, '❌ Failed to save.', true);
        return;
      }
      
      await answerCallback(env.TELEGRAM_BOT_TOKEN, cb.id, '✅ Link Saved!');
      await editMessageText(env.TELEGRAM_BOT_TOKEN, chatId, messageId, 
        `✅ <b>Saved!</b>\n\n<b>${escapeHtml(draft.page_title || 'Untitled')}</b>\n${escapeHtml(draft.url)}`, 
        null
      );
      
    } else if (action === 'cancel') {
      const draftId = linkIdStr;
      await db.from('links').delete().eq('id', draftId).eq('telegram_user_id', userId);
      
      await answerCallback(env.TELEGRAM_BOT_TOKEN, cb.id, '❌ Cancelled');
      await editMessageText(env.TELEGRAM_BOT_TOKEN, chatId, messageId, '❌ <i>Save cancelled.</i>', null);
    }
    return;
  }

  // Handle Message
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'User';
    const text = msg.text || '';
    
    const { data: session } = await db.from('bot_sessions').select('*').eq('telegram_user_id', userId).maybeSingle();
    const isAuthenticated = session && session.is_authenticated;
    
    if (text.startsWith('/login')) {
      const parts = text.split(' ');
      if (parts.length !== 3) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Usage: <code>/login &lt;username&gt; &lt;password&gt;</code>');
        return;
      }
      const [, user, pass] = parts;
      if (user === env.ADMIN_USERNAME && pass === env.ADMIN_PASSWORD) {
        if (session) {
          await db.from('bot_sessions').update({ is_authenticated: true, last_active: new Date().toISOString() }).eq('telegram_user_id', userId);
        } else {
          await db.from('bot_sessions').insert({ telegram_user_id: userId, username, is_authenticated: true });
        }
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '✅ <b>Authenticated Successfully!</b>\nYou can now save links.');
      } else {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ <b>Invalid Credentials</b>\nCheck your username and password.');
      }
      return;
    }

    if (!isAuthenticated) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '🔒 <b>Access Denied</b>\nPlease login first:\n<code>/login &lt;username&gt; &lt;password&gt;</code>');
      return;
    }

    if (text === '/help') {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 
        '<b>🤖 Link Vault Bot Commands:</b>\n\n' +
        '<code>/login &lt;user&gt; &lt;pass&gt;</code> - Authenticate\n' +
        '<code>/list [query]</code> - List or search links\n' +
        '<code>/delete &lt;id&gt;</code> - Delete a link\n' +
        '<code>/backup</code> - Export data\n' +
        '<code>/stats</code> - View statistics\n' +
        '\n<i>Just send any URL to save it!</i>'
      );
      return;
    }

    if (text === '/stats') {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '📊 <b>Statistics</b>\n\nYou are authenticated and ready to save links.');
      return;
    }

    if (text.startsWith('/list')) {
      const { data: links, error } = await db.from('links').select('*').eq('telegram_user_id', userId).neq('is_draft', true).order('id', { ascending: false }).limit(10).fetch();
      
      if (error || !links || links.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '📭 No links found yet.');
        return;
      }
      
      let msgText = '<b>📚 Your Recent Links:</b>\n\n';
      links.forEach(l => {
        msgText += `<b>#${l.id}</b> <a href="${escapeHtml(l.url)}">${escapeHtml(l.page_title || 'Link')}</a>\n`;
      });
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, msgText);
      return;
    }

    if (text.startsWith('/delete')) {
      const id = parseInt(text.split(' ')[1]);
      if (!id) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Usage: <code>/delete &lt;id&gt;</code>');
        return;
      }
      const { error } = await db.from('links').delete().eq('id', id).eq('telegram_user_id', userId);
      if (error) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Failed to delete. Maybe wrong ID?');
      } else {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `✅ Link #${id} deleted.`);
      }
      return;
    }

    // Detect URL in any message
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/;
    const match = text.match(urlRegex);
    
    if (match) {
      const urlStr = match[0];
      
      const safety = await validateUrlSafety(urlStr);
      if (!safety.safe) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ <b>Unsafe Link Detected</b>\n${safety.reason}`);
        return;
      }

      const loadingMsg = await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '⏳ <i>Fetching page details...</i>');
      
      let pageTitle = 'Untitled';
      try {
        const res = await fetch(urlStr, { 
          headers: { 'User-Agent': 'LinkVaultBot/1.0' },
          cf: { cacheTtl: 86400 }
        });
        if (res.ok) {
          const html = await res.text();
          const doc = parseHTML(html);
          const titleNode = doc.querySelector('title');
          if (titleNode && titleNode.textContent) {
            pageTitle = titleNode.textContent.trim();
          } else {
            const h1Node = doc.querySelector('h1');
            if (h1Node && h1Node.textContent) pageTitle = h1Node.textContent.trim();
          }
        }
      } catch (e) {
        console.error('Fetch error:', e);
      }

      const { data: draft, error: insertErr } = await db.from('links').insert({
        telegram_user_id: userId,
        url: urlStr,
        page_title: pageTitle,
        is_draft: true,
        created_at: new Date().toISOString()
      });

      if (insertErr || !draft) {
        await editMessageText(env.TELEGRAM_BOT_TOKEN, chatId, loadingMsg.result.message.message_id, '❌ Failed to prepare link save.');
        return;
      }

      const draftId = draft.id;
      
      const previewText = `🔗 <b>Found a link!</b>\n\n<b>Title:</b> ${escapeHtml(pageTitle)}\n<b>URL:</b> <a href="${escapeHtml(urlStr)}">${escapeHtml(urlStr)}</a>\n\n<i>Do you want to save this?</i>`;
      
      const keyboard = createInlineKeyboard(draftId, userId);
      
      await editMessageText(env.TELEGRAM_BOT_TOKEN, chatId, loadingMsg.result.message.message_id, previewText, keyboard);
    }
  }
}
