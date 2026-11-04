import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  blobToCameraFile,
  cameraFileName,
  describeCameraError,
  frameSize,
  supportsLiveCamera,
} from './camera.ts'

const DATE = new Date('2026-11-04T16:42:08.500Z')

describe('supportsLiveCamera', () => {
  it('is true when getUserMedia exists in a secure context', () => {
    assert.strictEqual(
      supportsLiveCamera({ mediaDevices: { getUserMedia: () => Promise.resolve() }, isSecureContext: true }),
      true,
    )
  })

  it('is false on a plain-http page, where browsers hide getUserMedia', () => {
    assert.strictEqual(
      supportsLiveCamera({ mediaDevices: { getUserMedia: () => Promise.resolve() }, isSecureContext: false }),
      false,
    )
  })

  it('is false when mediaDevices is missing entirely', () => {
    assert.strictEqual(supportsLiveCamera({ isSecureContext: true }), false)
    assert.strictEqual(supportsLiveCamera(undefined), false)
  })
})

describe('cameraFileName', () => {
  it('stamps the capture time into the name', () => {
    assert.strictEqual(cameraFileName(DATE), 'camera-2026-11-04T16-42-08-500.jpg')
  })

  it('honours the requested extension', () => {
    assert.strictEqual(cameraFileName(DATE, 'png'), 'camera-2026-11-04T16-42-08-500.png')
  })
})

describe('blobToCameraFile', () => {
  it('wraps a jpeg frame as a File with a jpg name', () => {
    const file = blobToCameraFile(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), DATE)
    assert.strictEqual(file.type, 'image/jpeg')
    assert.strictEqual(file.name, 'camera-2026-11-04T16-42-08-500.jpg')
    assert.strictEqual(file.size, 3)
  })

  it('matches the extension to the blob type', () => {
    assert.ok(blobToCameraFile(new Blob([], { type: 'image/png' }), DATE).name.endsWith('.png'))
    assert.ok(blobToCameraFile(new Blob([], { type: 'image/webp' }), DATE).name.endsWith('.webp'))
  })

  it('defaults to jpeg when the blob carries no type', () => {
    const file = blobToCameraFile(new Blob([new Uint8Array([1])]), DATE)
    assert.strictEqual(file.type, 'image/jpeg')
    assert.ok(file.name.endsWith('.jpg'))
  })
})

describe('describeCameraError', () => {
  it('explains a blocked permission', () => {
    assert.match(describeCameraError({ name: 'NotAllowedError' }), /permission was blocked/i)
  })

  it('explains a missing camera', () => {
    assert.match(describeCameraError({ name: 'NotFoundError' }), /no camera was found/i)
  })

  it('explains a camera already in use', () => {
    assert.match(describeCameraError({ name: 'NotReadableError' }), /already in use/i)
  })

  it('falls back to a generic message for anything else', () => {
    assert.match(describeCameraError(new Error('boom')), /could not start the camera/i)
    assert.match(describeCameraError(null), /could not start the camera/i)
  })
})

describe('frameSize', () => {
  it('leaves a small frame untouched', () => {
    assert.deepStrictEqual(frameSize(1280, 720), { width: 1280, height: 720 })
  })

  it('scales a 4K frame down to the cap, keeping the aspect ratio', () => {
    assert.deepStrictEqual(frameSize(3840, 2160, 2048), { width: 2048, height: 1152 })
    assert.deepStrictEqual(frameSize(2160, 3840, 2048), { width: 1152, height: 2048 })
  })

  it('never upscales', () => {
    assert.deepStrictEqual(frameSize(320, 240, 2048), { width: 320, height: 240 })
  })

  it('returns zeros before the video reports its dimensions', () => {
    assert.deepStrictEqual(frameSize(0, 0), { width: 0, height: 0 })
  })
})
