/**
 * Helpers for turning clipboard items into uploadable image files.
 * Kept free of DOM types so they can be unit tested in Node.
 */

/** The subset of `DataTransferItem` we need. */
export interface ClipboardItemLike {
  kind: string
  type: string
  getAsFile: () => File | null
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export function extensionForMime(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] ?? 'png'
}

/**
 * Clipboard images arrive named "image.png" (or with no name at all), so every
 * paste gets a unique, readable name based on the moment it was pasted.
 */
export function pastedFileName(mimeType: string, date: Date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace('Z', '')
  return `pasted-${stamp}.${extensionForMime(mimeType)}`
}

/**
 * Pull image files out of a clipboard payload. Text, HTML and other clipboard
 * entries are ignored, so pasting a URL into a field keeps working normally.
 */
export function collectClipboardImages(
  items: ArrayLike<ClipboardItemLike>,
  date: Date = new Date(),
): File[] {
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (!file) continue
    const named = file.name && file.name !== 'image.png' ? file : undefined
    files.push(
      named
        ? named
        : new File([file], pastedFileName(item.type || file.type, date), {
            type: item.type || file.type,
          }),
    )
  }
  return files
}
