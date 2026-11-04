/**
 * End-to-end regression test for the counter bug: uploading an image (drop) added a row to the
 * table but left the "Title / #" field on the number that had just been taken, so the next manual
 * save would duplicate it.
 *
 * The dashboard is rendered in jsdom and a real `drop` event is dispatched at `window`, which is
 * what ImageDropZone listens for. The upload route is mocked.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const globals = globalThis as unknown as Record<string, unknown>
globals.window = dom.window
globals.document = dom.window.document
globals.navigator = dom.window.navigator
globals.HTMLElement = dom.window.HTMLElement
globals.Node = dom.window.Node
globals.Event = dom.window.Event
globals.MouseEvent = dom.window.MouseEvent
globals.KeyboardEvent = dom.window.KeyboardEvent
globals.File = dom.window.File
globals.getComputedStyle = dom.window.getComputedStyle
globals.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
globals.cancelAnimationFrame = (id: number) => clearTimeout(id)
globals.IS_REACT_ACT_ENVIRONMENT = true

type ReactModule = typeof import('react')
let React: ReactModule
let act: ReactModule['act']
let createRoot: (typeof import('react-dom/client'))['createRoot']
let Dashboard: () => React.ReactElement

const realFetch = globalThis.fetch
let vaultMax = 355 // highest existing title; the form should offer 356

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('dashboard counter after an image upload', () => {
  before(async () => {
    React = await import('react')
    act = React.act
    ;({ createRoot } = await import('react-dom/client'))
    Dashboard = (await import('../app/page.tsx')).default as unknown as () => React.ReactElement

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/links/next-id')) return json({ nextId: vaultMax + 1 })
      if (url.includes('/api/upload')) {
        vaultMax += 1
        const id = String(vaultMax)
        return json(
          {
            image: { url: 'https://i.ibb.co/x/pic.png' },
            link: {
              id: 'link-1',
              title: id,
              page_title: 'pic.png',
              url: 'https://i.ibb.co/x/pic.png',
              category: '🖼️ #Image',
              created_at: new Date().toISOString(),
            },
          },
          201,
        )
      }
      if (url.includes('/api/links') && (init?.method ?? 'GET') === 'GET') return json([])
      return json({})
    }) as unknown as typeof fetch
  })

  after(() => {
    globalThis.fetch = realFetch
  })

  it('moves the "Title / #" counter on after a dropped image is saved', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(React.createElement(Dashboard))
    })
    await act(async () => {
      await Promise.resolve()
    })

    const titleInput = container.querySelector('#title') as HTMLInputElement
    assert.strictEqual(titleInput.value, '356', 'the counter starts at the current maximum')

    // A file is dropped anywhere on the dashboard.
    const file = new dom.window.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'pic.png', {
      type: 'image/png',
    })
    const drop = new dom.window.Event('drop', { bubbles: true }) as Event & {
      dataTransfer?: unknown
    }
    drop.dataTransfer = { types: ['Files'], files: [file], dropEffect: 'copy' }

    await act(async () => {
      dom.window.dispatchEvent(drop)
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    assert.strictEqual(vaultMax, 356, 'the upload should have created entry 356')
    assert.strictEqual(
      (container.querySelector('#title') as HTMLInputElement).value,
      '357',
      'the counter must follow the vault, not stay on the number that was just used',
    )

    act(() => root.unmount())
    container.remove()
  })
})
