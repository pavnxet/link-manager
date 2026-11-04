'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X, Loader2, ImageUp } from 'lucide-react'
import { blobToCameraFile, describeCameraError, frameSize } from '@/lib/camera'

interface CameraCaptureProps {
  open: boolean
  onClose: () => void
  /** Receives the captured frame as a File, ready for the shared upload queue. */
  onCapture: (file: File) => void
  /** Used when the camera cannot be opened: hands off to the device's own camera app. */
  onFallback: () => void
}

type Status = 'starting' | 'ready' | 'error'

export default function CameraCapture({ open, onClose, onCapture, onFallback }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [error, setError] = useState('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [busy, setBusy] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const close = useCallback(() => {
    stopStream()
    setStatus('starting')
    setError('')
    setBusy(false)
    onClose()
  }, [onClose, stopStream])

  // Start (or restart) the stream whenever the modal opens or the camera is flipped.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const start = async () => {
      setStatus('starting')
      setError('')
      stopStream()

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setError(describeCameraError(new TypeError('getUserMedia unavailable')))
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(describeCameraError(err))
      }
    }

    void start()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, facingMode, stopStream])

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const capture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    setBusy(true)
    try {
      const { width, height } = frameSize(video.videoWidth, video.videoHeight)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(video, 0, 0, width, height)

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(result => resolve(result), 'image/jpeg', 0.92),
      )
      if (!blob) throw new Error('could not encode the frame')

      onCapture(blobToCameraFile(blob))
      close()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error && err.message ? err.message : describeCameraError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
            <Camera className="h-4 w-4 text-blue-400" />
            Take a photo
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`max-h-[60vh] w-full object-contain ${status === 'ready' ? '' : 'opacity-40'}`}
          />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting camera...
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="max-w-md text-sm text-gray-300">{error}</p>
              <button
                type="button"
                onClick={() => {
                  close()
                  onFallback()
                }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                <ImageUp className="h-4 w-4" />
                Upload a file instead
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setFacingMode(m => (m === 'environment' ? 'user' : 'environment'))}
            disabled={status !== 'ready'}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-blue-600 hover:text-white disabled:opacity-40"
            title="Switch camera (rear / front)"
          >
            <RefreshCw className="h-4 w-4" />
            Switch
          </button>

          <button
            type="button"
            onClick={capture}
            disabled={status !== 'ready' || busy}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Capture &amp; upload
          </button>

          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
