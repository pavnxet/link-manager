import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  IMGBB_MAX_BYTES,
  ImgbbError,
  detectImageType,
  uploadImageToImgbb,
} from './imgbb.ts'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

const SUCCESS_BODY = {
  data: {
    id: 'abc123',
    title: 'screenshot',
    url_viewer: 'https://ibb.co/abc123',
    url: 'https://i.ibb.co/abc123/screenshot.png',
    display_url: 'https://i.ibb.co/xyz/screenshot.png',
    width: '1280',
    height: '720',
    size: '48213',
    delete_url: 'https://ibb.co/abc123/delete',
    image: { url: 'https://i.ibb.co/abc123/screenshot.png' },
    thumb: { url: 'https://i.ibb.co/abc123/thumb.png' },
  },
  success: true,
  status: 200,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fakeFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const requestInit = init ?? {}
    calls.push({ url, init: requestInit })
    return handler(url, requestInit)
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('detectImageType', () => {
  it('recognises the common image formats from their magic bytes', () => {
    assert.strictEqual(detectImageType(PNG_BYTES), 'image/png')
    assert.strictEqual(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
    assert.strictEqual(detectImageType(new TextEncoder().encode('GIF89a')), 'image/gif')
    assert.strictEqual(
      detectImageType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
      'image/webp',
    )
    assert.strictEqual(detectImageType(new TextEncoder().encode('<svg xmlns="x"></svg>')), 'image/svg+xml')
  })

  it('returns null for non-image payloads', () => {
    assert.strictEqual(detectImageType(new TextEncoder().encode('hello world')), null)
    assert.strictEqual(detectImageType(new TextEncoder().encode('MZ\x90\x00')), null)
    assert.strictEqual(detectImageType(new Uint8Array(0)), null)
  })
})

describe('uploadImageToImgbb', () => {
  it('posts the image as base64 to the ImgBB endpoint and maps the response', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(SUCCESS_BODY))

    const result = await uploadImageToImgbb(
      { bytes: PNG_BYTES, filename: 'screenshot.png' },
      { apiKey: 'test-key', fetchImpl: impl },
    )

    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].url, 'https://api.imgbb.com/1/upload?key=test-key')
    assert.strictEqual(calls[0].init.method, 'POST')

    const form = calls[0].init.body as FormData
    assert.strictEqual(form.get('name'), 'screenshot')
    assert.strictEqual(
      form.get('image'),
      Buffer.from(PNG_BYTES).toString('base64'),
      'image must be sent as base64',
    )

    assert.strictEqual(result.url, 'https://i.ibb.co/abc123/screenshot.png')
    assert.strictEqual(result.displayUrl, 'https://i.ibb.co/xyz/screenshot.png')
    assert.strictEqual(result.thumbUrl, 'https://i.ibb.co/abc123/thumb.png')
    assert.strictEqual(result.deleteUrl, 'https://ibb.co/abc123/delete')
    assert.strictEqual(result.width, 1280)
    assert.strictEqual(result.height, 720)
    assert.strictEqual(result.size, 48213)
    assert.strictEqual(result.id, 'abc123')
  })

  it('adds an expiration when one is requested', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(SUCCESS_BODY))

    await uploadImageToImgbb(
      { bytes: PNG_BYTES, expiration: 600 },
      { apiKey: 'test-key', fetchImpl: impl },
    )

    assert.strictEqual(calls[0].url, 'https://api.imgbb.com/1/upload?key=test-key&expiration=600')
  })

  it('throws MISSING_API_KEY when no key is configured', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(SUCCESS_BODY))

    await assert.rejects(
      () => uploadImageToImgbb({ bytes: PNG_BYTES }, { apiKey: '', fetchImpl: impl }),
      (err: unknown) => {
        assert.ok(err instanceof ImgbbError)
        assert.strictEqual(err.code, 'MISSING_API_KEY')
        assert.strictEqual(err.status, 500)
        return true
      },
    )
    assert.strictEqual(calls.length, 0, 'no request should be made without a key')
  })

  it('rejects empty and oversized files before calling ImgBB', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(SUCCESS_BODY))

    await assert.rejects(
      () => uploadImageToImgbb({ bytes: new Uint8Array(0) }, { apiKey: 'k', fetchImpl: impl }),
      (err: unknown) => err instanceof ImgbbError && err.code === 'EMPTY_FILE',
    )

    await assert.rejects(
      () =>
        uploadImageToImgbb(
          { bytes: new Uint8Array(IMGBB_MAX_BYTES + 1) },
          { apiKey: 'k', fetchImpl: impl },
        ),
      (err: unknown) => err instanceof ImgbbError && err.code === 'FILE_TOO_LARGE' && err.status === 413,
    )

    assert.strictEqual(calls.length, 0)
  })

  it('surfaces an ImgBB error message as a 502', async () => {
    const { impl } = fakeFetch(() =>
      jsonResponse({ success: false, status: 400, error: { message: 'Invalid API key', code: 100 } }, 400),
    )

    await assert.rejects(
      () => uploadImageToImgbb({ bytes: PNG_BYTES }, { apiKey: 'secret-key-value', fetchImpl: impl }),
      (err: unknown) => {
        assert.ok(err instanceof ImgbbError)
        assert.strictEqual(err.status, 502)
        assert.match(err.message, /Invalid API key/)
        assert.doesNotMatch(err.message, /secret-key-value/, 'the API key must never leak')
        return true
      },
    )
  })

  it('handles a non-JSON response', async () => {
    const { impl } = fakeFetch(() => new Response('<html>gateway error</html>', { status: 502 }))

    await assert.rejects(
      () => uploadImageToImgbb({ bytes: PNG_BYTES }, { apiKey: 'k', fetchImpl: impl }),
      (err: unknown) => err instanceof ImgbbError && err.code === 'BAD_RESPONSE',
    )
  })

  it('handles a network failure', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    await assert.rejects(
      () => uploadImageToImgbb({ bytes: PNG_BYTES }, { apiKey: 'k', fetchImpl: impl }),
      (err: unknown) => err instanceof ImgbbError && err.code === 'UPLOAD_FAILED' && err.status === 502,
    )
  })

  it('falls back to the environment key when none is passed', async () => {
    const original = process.env.IMGBB_API_KEY
    process.env.IMGBB_API_KEY = 'env-key'
    const { impl, calls } = fakeFetch(() => jsonResponse(SUCCESS_BODY))

    try {
      await uploadImageToImgbb({ bytes: PNG_BYTES }, { fetchImpl: impl })
      assert.match(calls[0].url, /key=env-key/)
    } finally {
      if (original === undefined) delete process.env.IMGBB_API_KEY
      else process.env.IMGBB_API_KEY = original
    }
  })
})
