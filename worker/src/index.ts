import { parseCommand, parseKeyValueArgs } from './commands.ts'
import { scrape } from './scrape.ts'
import { SupabaseRepository } from './supabase.ts'
import { createSession, isSessionValid, refreshSession, type Session } from './session.ts'

type Env = {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SESSION_TTL_SECONDS?: string
  RATE_LIMIT_PER_MINUTE?: string
  SESSIONS: KVNamespace
  RATE_LIMIT: KVNamespace
}

type TelegramUpdate = {
  message?: {
    message_id: number
    text?: string
    chat: { id: number; type: string }
    from?: { id: number; username?: string }
    document?: { file_id: string; file_name?: string }
  }
}

const HELP_TEXT = [
  'Available commands:',
  '/login <username> <password>',
  '/nextid',
  '/add <url> [title] [category=#Tag]',
  '/list [query]',
  '/search <query>',
  '/edit <id> title=<newTitle> page_title=<newPageTitle> category=<newCategory> url=<newUrl>',
  '/delete <id> (then /confirm <token>)',
  '/backup',
  '/restore (then send a .json file)',
  '/scrape <url>',
  '/help',
].join('\n')

function getSessionTtlSeconds(env: Env): number {
  const parsed = Number(env.SESSION_TTL_SECONDS || '86400')
  return Number.isFinite(parsed) && parsed > 60 ? parsed : 86400
}

function getRateLimitPerMinute(env: Env): number {
  const parsed = Number(env.RATE_LIMIT_PER_MINUTE || '30')
  return Number.isFinite(parsed) && parsed > 5 ? parsed : 30
}

async function isRateLimited(env: Env, chatId: number): Promise<boolean> {
  const minuteBucket = Math.floor(Date.now() / 60000)
  const key = `${chatId}:${minuteBucket}`
  const limit = getRateLimitPerMinute(env)
  const current = Number((await env.RATE_LIMIT.get(key)) || '0')
  if (current >= limit) return true
  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: 120 })
  return false
}

async function sendTelegramMessage(env: Env, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
}

async function sendTelegramDocument(env: Env, chatId: number, filename: string, content: string, caption: string): Promise<void> {
  const form = new FormData()
  form.append('chat_id', String(chatId))
  form.append('caption', caption)
  form.append('document', new File([content], filename, { type: 'application/json' }))

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: form,
  })
}

async function getFileContent(env: Env, fileId: string): Promise<string> {
  const fileRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  const fileJson = await fileRes.json() as { ok: boolean; result?: { file_path?: string } }
  const filePath = fileJson.result?.file_path

  if (!fileRes.ok || !fileJson.ok || !filePath) {
    throw new Error('Failed to fetch Telegram file metadata')
  }

  const fileDownloadRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`)
  if (!fileDownloadRes.ok) {
    throw new Error('Failed to download Telegram file')
  }

  return await fileDownloadRes.text()
}

async function getSession(env: Env, chatId: number): Promise<Session | null> {
  const raw = await env.SESSIONS.get(`session:${chatId}`)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

async function setSession(env: Env, session: Session): Promise<void> {
  const ttl = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000))
  await env.SESSIONS.put(`session:${session.chatId}`, JSON.stringify(session), { expirationTtl: ttl })
}

async function requireAuthorizedSession(env: Env, chatId: number): Promise<{ ok: true; session: Session } | { ok: false; reason: string }> {
  const session = await getSession(env, chatId)
  if (!isSessionValid(session)) {
    return { ok: false, reason: 'Unauthorized. Please login with /login <username> <password>.' }
  }

  const authorizedChatId = await env.SESSIONS.get('authorized_chat_id')
  if (authorizedChatId && Number(authorizedChatId) !== chatId) {
    return { ok: false, reason: 'This bot is locked to another authorized admin chat.' }
  }

  return { ok: true, session }
}

function formatLinks(lines: Array<{ id: string; title: string; category: string | null; url: string }>): string {
  if (!lines.length) return 'No links found.'
  return lines
    .slice(0, 20)
    .map((link, index) => `${index + 1}. [${link.title}] ${link.category || '🔗 #Link'}\n${link.url}\n(id: ${link.id})`)
    .join('\n\n')
}

async function handleCommand(env: Env, update: TelegramUpdate): Promise<void> {
  const message = update.message
  if (!message) return

  const chatId = message.chat.id
  const userId = message.from?.id

  if (await isRateLimited(env, chatId)) {
    await sendTelegramMessage(env, chatId, 'Rate limit exceeded. Please wait a minute and try again.')
    return
  }

  const text = message.text || ''
  const parsed = parseCommand(text)

  const sessionRecord = await getSession(env, chatId)
  if (sessionRecord?.waitingForRestoreFile && message.document) {
    const auth = await requireAuthorizedSession(env, chatId)
    if (!auth.ok) {
      await sendTelegramMessage(env, chatId, auth.reason)
      return
    }

    try {
      const content = await getFileContent(env, message.document.file_id)
      const parsedJson = JSON.parse(content)
      if (!Array.isArray(parsedJson)) {
        throw new Error('Backup format must be a JSON array')
      }

      const repo = new SupabaseRepository(env)
      const result = await repo.bulkInsertLinks(parsedJson)

      const refreshed: Session = { ...auth.session, waitingForRestoreFile: false }
      await setSession(env, refreshSession(refreshed, getSessionTtlSeconds(env)))
      await sendTelegramMessage(env, chatId, `Restore completed. Processed ${result.count} links.`)
    } catch (error) {
      await sendTelegramMessage(env, chatId, `Restore failed: ${(error as Error).message}`)
    }
    return
  }

  if (!parsed) {
    await sendTelegramMessage(env, chatId, HELP_TEXT)
    return
  }

  if (parsed.name === 'start' || parsed.name === 'help') {
    await sendTelegramMessage(env, chatId, HELP_TEXT)
    return
  }

  if (parsed.name === 'login') {
    const [username, password] = parsed.args
    if (!username || !password) {
      await sendTelegramMessage(env, chatId, 'Usage: /login <username> <password>')
      return
    }

    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
      await sendTelegramMessage(env, chatId, 'Invalid credentials.')
      return
    }

    const lockedChat = await env.SESSIONS.get('authorized_chat_id')
    if (lockedChat && Number(lockedChat) !== chatId) {
      await sendTelegramMessage(env, chatId, 'This bot is already locked to another admin chat.')
      return
    }

    await env.SESSIONS.put('authorized_chat_id', String(chatId))
    const session = createSession(chatId, userId, getSessionTtlSeconds(env))
    await setSession(env, session)
    await sendTelegramMessage(env, chatId, 'Login successful. You can now manage your links.')
    return
  }

  const auth = await requireAuthorizedSession(env, chatId)
  if (!auth.ok) {
    await sendTelegramMessage(env, chatId, auth.reason)
    return
  }

  const repo = new SupabaseRepository(env)

  try {
    if (parsed.name === 'nextid') {
      const nextId = await repo.getNextNumericId()
      await sendTelegramMessage(env, chatId, `Next numeric title ID: ${nextId}`)
    } else if (parsed.name === 'scrape') {
      const [url] = parsed.args
      if (!url) {
        await sendTelegramMessage(env, chatId, 'Usage: /scrape <url>')
        return
      }
      const result = await scrape(url)
      await sendTelegramMessage(env, chatId, `Title: ${result.title}\nCategory: ${result.category}`)
    } else if (parsed.name === 'add') {
      const [url, ...rest] = parsed.args
      if (!url) {
        await sendTelegramMessage(env, chatId, 'Usage: /add <url> [title] [category=#Tag]')
        return
      }

      const kv = parseKeyValueArgs(rest)
      const scraped = await scrape(url)
      const title = kv.title || rest.find((part) => !part.includes('=')) || String(await repo.getNextNumericId())
      const pageTitle = kv.page_title || scraped.title
      const category = kv.category || scraped.category

      const created = await repo.addLink({ url, title, page_title: pageTitle, category })
      await sendTelegramMessage(env, chatId, `Saved ✅\nID: ${created.id}\nTitle: ${created.title}`)
    } else if (parsed.name === 'list' || parsed.name === 'search') {
      const query = parsed.args.join(' ').trim()
      const links = await repo.getLinks(query || undefined)
      await sendTelegramMessage(env, chatId, formatLinks(links))
    } else if (parsed.name === 'edit') {
      const [id, ...rest] = parsed.args
      if (!id || rest.length === 0) {
        await sendTelegramMessage(env, chatId, 'Usage: /edit <id> title=<...> page_title=<...> category=<...> url=<...>')
        return
      }
      const patch = parseKeyValueArgs(rest)
      if (!Object.keys(patch).length) {
        await sendTelegramMessage(env, chatId, 'No editable fields provided.')
        return
      }
      const updated = await repo.updateLink(id, patch)
      await sendTelegramMessage(env, chatId, `Updated ✅\nID: ${updated.id}\nTitle: ${updated.title}`)
    } else if (parsed.name === 'delete') {
      const [id] = parsed.args
      if (!id) {
        await sendTelegramMessage(env, chatId, 'Usage: /delete <id>')
        return
      }
      const token = crypto.randomUUID().slice(0, 8)
      const pending: Session = {
        ...auth.session,
        pendingConfirm: { action: 'delete', targetId: id, token, expiresAt: Date.now() + 5 * 60 * 1000 },
      }
      await setSession(env, refreshSession(pending, getSessionTtlSeconds(env)))
      await sendTelegramMessage(env, chatId, `Confirm deletion with: /confirm ${token}`)
    } else if (parsed.name === 'confirm') {
      const [token] = parsed.args
      const pending = auth.session.pendingConfirm
      if (!pending || pending.action !== 'delete') {
        await sendTelegramMessage(env, chatId, 'No pending destructive action.')
        return
      }
      if (pending.expiresAt < Date.now()) {
        await sendTelegramMessage(env, chatId, 'Confirmation expired. Retry /delete.')
        return
      }
      if (!token || token !== pending.token) {
        await sendTelegramMessage(env, chatId, 'Invalid confirmation token.')
        return
      }

      await repo.deleteLink(pending.targetId)
      const cleared: Session = { ...auth.session, pendingConfirm: undefined }
      await setSession(env, refreshSession(cleared, getSessionTtlSeconds(env)))
      await sendTelegramMessage(env, chatId, 'Deleted ✅')
    } else if (parsed.name === 'backup') {
      const links = await repo.getAllLinksForBackup()
      const content = JSON.stringify(links, null, 2)
      const filename = `link-manager-backup-${new Date().toISOString().slice(0, 10)}.json`
      await sendTelegramDocument(env, chatId, filename, content, `Backup export (${links.length} links)`)
    } else if (parsed.name === 'restore') {
      const nextSession: Session = { ...auth.session, waitingForRestoreFile: true }
      await setSession(env, refreshSession(nextSession, getSessionTtlSeconds(env)))
      await sendTelegramMessage(env, chatId, 'Send a .json backup file now to import. Existing URLs will be deduplicated.')
    } else {
      await sendTelegramMessage(env, chatId, HELP_TEXT)
    }

    const latest = await getSession(env, chatId)
    if (latest) {
      await setSession(env, refreshSession(latest, getSessionTtlSeconds(env)))
    }
  } catch (error) {
    await sendTelegramMessage(env, chatId, `Command failed: ${(error as Error).message}`)
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'link-manager-worker' }), {
        headers: { 'content-type': 'application/json' },
      })
    }

    if (request.method !== 'POST' || url.pathname !== '/webhook') {
      return new Response('Not found', { status: 404 })
    }

    const token = request.headers.get('x-telegram-bot-api-secret-token')
    if (!token || token !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    let update: TelegramUpdate
    try {
      update = (await request.json()) as TelegramUpdate
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    await handleCommand(env, update)
    return new Response('ok')
  },
}

export default worker
export { handleCommand }
