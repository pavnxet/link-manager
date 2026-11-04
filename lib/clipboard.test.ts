import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  collectClipboardImages,
  extensionForMime,
  pastedFileName,
  type ClipboardItemLike,
} from './clipboard.ts'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function item(kind: string, type: string, file: File | null): ClipboardItemLike {
  return { kind, type, getAsFile: () => file }
}

function imageFile(name = 'image.png', type = 'image/png') {
  return new File([PNG_BYTES], name, { type })
}

describe('extensionForMime', () => {
  it('maps image MIME types to file extensions', () => {
    assert.strictEqual(extensionForMime('image/png'), 'png')
    assert.strictEqual(extensionForMime('image/jpeg'), 'jpg')
    assert.strictEqual(extensionForMime('image/svg+xml'), 'svg')
  })

  it('falls back to png for an unknown type', () => {
    assert.strictEqual(extensionForMime('image/x-unknown'), 'png')
  })
})

describe('pastedFileName', () => {
  it('builds a unique, readable name from the paste time', () => {
    const name = pastedFileName('image/png', new Date('2026-11-04T10:15:30.500Z'))
    assert.strictEqual(name, 'pasted-2026-11-04T10-15-30-500.png')
  })

  it('uses the matching extension for jpeg and svg', () => {
    const date = new Date('2026-01-02T03:04:05.000Z')
    assert.ok(pastedFileName('image/jpeg', date).endsWith('.jpg'))
    assert.ok(pastedFileName('image/svg+xml', date).endsWith('.svg'))
  })
})

describe('collectClipboardImages', () => {
  const date = new Date('2026-11-04T10:15:30.500Z')

  it('extracts image files from the clipboard', () => {
    const files = collectClipboardImages([item('file', 'image/png', imageFile())], date)
    assert.strictEqual(files.length, 1)
    assert.strictEqual(files[0].type, 'image/png')
    assert.strictEqual(files[0].name, 'pasted-2026-11-04T10-15-30-500.png')
  })

  it('keeps a real filename when the clipboard provides one', () => {
    const files = collectClipboardImages([item('file', 'image/png', imageFile('screenshot.png'))], date)
    assert.strictEqual(files.length, 1)
    assert.strictEqual(files[0].name, 'screenshot.png')
  })

  it('renames the generic "image.png" that browsers put on the clipboard', () => {
    const files = collectClipboardImages([item('file', 'image/jpeg', imageFile('image.png', 'image/jpeg'))], date)
    assert.strictEqual(files[0].name, 'pasted-2026-11-04T10-15-30-500.jpg')
  })

  it('ignores pasted text, HTML and other non-image entries', () => {
    const files = collectClipboardImages(
      [
        item('string', 'text/plain', null),
        item('string', 'text/html', null),
        item('file', 'application/pdf', new File([new Uint8Array([1])], 'doc.pdf')),
      ],
      date,
    )
    assert.deepStrictEqual(files, [], 'pasting a URL must not trigger an upload')
  })

  it('skips image entries with no file attached', () => {
    assert.deepStrictEqual(collectClipboardImages([item('file', 'image/png', null)], date), [])
  })

  it('collects several images from one paste', () => {
    const files = collectClipboardImages(
      [item('file', 'image/png', imageFile()), item('file', 'image/webp', imageFile('shot.webp', 'image/webp'))],
      date,
    )
    assert.strictEqual(files.length, 2)
    assert.strictEqual(files[1].name, 'shot.webp')
  })
})
