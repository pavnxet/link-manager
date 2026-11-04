/** Shared input cleaning for the link routes. */
export const MAX_TITLE = 200
export const MAX_TEXT = 500

export function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
