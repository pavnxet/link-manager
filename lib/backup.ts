import type { LinkInsert } from './db'
import { parseHttpUrl } from './url-safety'
import { cleanText } from './validate'

export const MAX_ROWS = 10000

export type BackupValidation = { ok: true; rows: LinkInsert[] } | { ok: false; error: string }

/**
 * Validate a backup before touching the database.
 *
 * The route used to accept any array: one row without a url aborted the whole import with a raw
 * `NOT NULL constraint failed` message, and the user lost the entire restore.
 */
export function validateBackup(input: unknown): BackupValidation {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'Invalid format. Expected an array of links.' }
  }
  if (input.length === 0) {
    return { ok: false, error: 'The backup contains no links.' }
  }
  if (input.length > MAX_ROWS) {
    return { ok: false, error: `Too many links in one restore (limit ${MAX_ROWS}).` }
  }

  const rows: LinkInsert[] = []
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index]
    const position = index + 1
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `Entry ${position} is not an object.` }
    }
    const row = raw as Record<string, unknown>
    const title = cleanText(row.title, 200)
    const url = parseHttpUrl(row.url)

    if (!title) return { ok: false, error: `Entry ${position} has no title.` }
    if (!url) return { ok: false, error: `Entry ${position} has no valid http(s) url.` }

    rows.push({
      title,
      url: url.toString(),
      page_title: cleanText(row.page_title),
      category: cleanText(row.category),
      created_at:
        typeof row.created_at === 'string' && !Number.isNaN(Date.parse(row.created_at))
          ? row.created_at
          : undefined,
    })
  }
  return { ok: true, rows }
}
