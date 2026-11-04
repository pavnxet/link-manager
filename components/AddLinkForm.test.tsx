/**
 * The dashboard keeps a "Title / #" counter in AddLinkForm. It is refreshed through the
 * `refreshTrigger` prop, and this is the regression test for the bug where uploading an image
 * (drop / paste / camera) added a row but left the counter on the number that was just taken.
 *
 * Rendering needs a DOM, so this file builds one with jsdom before importing React.
 */
import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
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
globals.getComputedStyle = dom.window.getComputedStyle
globals.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
globals.cancelAnimationFrame = (id: number) => clearTimeout(id)
globals.IS_REACT_ACT_ENVIRONMENT = true

// Imported inside before() so React sees the jsdom globals above. (Top-level await is not
// available here: tsx compiles this file as CommonJS.)
type ReactModule = typeof import('react')
type ReactDomClient = typeof import('react-dom/client')
type AddLinkFormProps = {
  onLinkAdded: (link: unknown) => void
  refreshTrigger: number
}
type AddLinkFormComponent = (props: AddLinkFormProps) => React.ReactElement

let React: ReactModule
let createRoot: ReactDomClient['createRoot']
let act: ReactModule['act']
let AddLinkForm: AddLinkFormComponent

let nextId = 356
let nextIdRequests = 0

const realFetch = globalThis.fetch

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  return {
    container,
    async render(node: React.ReactElement) {
      await act(async () => {
        root.render(node)
      })
      // let the fetch promise inside the effect settle
      await act(async () => {
        await Promise.resolve()
      })
    },
    unmount() {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function titleInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('#title') as HTMLInputElement
}

describe('AddLinkForm counter', () => {
  before(async () => {
    React = await import('react')
    act = React.act
    ;({ createRoot } = await import('react-dom/client'))
    AddLinkForm = (await import('./AddLinkForm.tsx')).default as unknown as AddLinkFormComponent

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/links/next-id')) {
        nextIdRequests += 1
        return new Response(JSON.stringify({ nextId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof fetch
  })

  after(() => {
    globalThis.fetch = realFetch
  })

  beforeEach(() => {
    nextId = 356
    nextIdRequests = 0
  })

  it('shows the id the server suggests on mount', async () => {
    const view = mount()
    await view.render(React.createElement(AddLinkForm, { onLinkAdded: () => {}, refreshTrigger: 0 }))
    assert.strictEqual(titleInput(view.container).value, '356')
    view.unmount()
  })

  it('re-reads the counter when the parent bumps refreshTrigger (the upload case)', async () => {
    const view = mount()
    await view.render(React.createElement(AddLinkForm, { onLinkAdded: () => {}, refreshTrigger: 0 }))
    assert.strictEqual(titleInput(view.container).value, '356')
    const requestsAfterMount = nextIdRequests

    // An image upload happened elsewhere: the vault now has 356, so the next id is 357.
    nextId = 357
    await view.render(React.createElement(AddLinkForm, { onLinkAdded: () => {}, refreshTrigger: 1 }))

    assert.ok(nextIdRequests > requestsAfterMount, 'the trigger must cause a fresh next-id read')
    assert.strictEqual(titleInput(view.container).value, '357')
    view.unmount()
  })

  it('does not re-read when the trigger is unchanged', async () => {
    const view = mount()
    await view.render(React.createElement(AddLinkForm, { onLinkAdded: () => {}, refreshTrigger: 7 }))
    const requests = nextIdRequests
    await view.render(React.createElement(AddLinkForm, { onLinkAdded: () => {}, refreshTrigger: 7 }))
    assert.strictEqual(nextIdRequests, requests)
    view.unmount()
  })
})
