/**
 * Helpers for camera capture. Kept free of DOM-only APIs (video, canvas) so they can be unit
 * tested in Node; the browser plumbing lives in components/CameraCapture.tsx.
 */

export interface CameraCapabilities {
  mediaDevices?: { getUserMedia?: (constraints: unknown) => Promise<unknown> } | null
  isSecureContext?: boolean
}

/**
 * A live in-page preview needs `getUserMedia`, which browsers only expose in a secure context.
 * When it is missing (plain http, old browser, embedded webview) the UI falls back to a file input
 * with `capture="environment"`, which hands off to the device's own camera app.
 */
export function supportsLiveCamera(nav: CameraCapabilities | undefined = globalThis.navigator as unknown as CameraCapabilities): boolean {
  if (!nav) return false
  if (nav.isSecureContext === false) return false
  return typeof nav.mediaDevices?.getUserMedia === 'function'
}

/** Name for a captured frame, e.g. camera-2026-11-04T16-42-08.jpg */
export function cameraFileName(date: Date = new Date(), extension = 'jpg'): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace('Z', '')
  return `camera-${stamp}.${extension}`
}

/** Wrap a captured Blob in a File so it travels through the same upload queue as a dropped file. */
export function blobToCameraFile(blob: Blob, date: Date = new Date()): File {
  const type = blob.type || 'image/jpeg'
  const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], cameraFileName(date, extension), { type })
}

/**
 * Turn a getUserMedia rejection into something a person can act on.
 * The raw DOMException names are unhelpful ("NotAllowedError").
 */
export function describeCameraError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was blocked. Allow camera access for this site, or upload a file instead.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Upload a file instead.'
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is already in use by another app. Close it and try again.'
    case 'TypeError':
      return 'This browser cannot open the camera here. Upload a file instead.'
    default:
      return 'Could not start the camera. Upload a file instead.'
  }
}

/**
 * Pick a still-frame size from a video stream: the largest size that fits within `maxDim`, so a
 * 4K webcam does not produce a 6 MB JPEG for a screenshot of a whiteboard.
 */
export function frameSize(
  width: number,
  height: number,
  maxDim = 2048,
): { width: number; height: number } {
  if (!width || !height) return { width: 0, height: 0 }
  const scale = Math.min(1, maxDim / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
