'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clipboard, ImageUp, Loader2, X, XCircle } from 'lucide-react'
import type { Link } from './LinkTable'

interface ImageDropZoneProps {
  onUploaded: (link: Link) => void
  children: React.ReactNode
}

interface Toast {
  id: number
  kind: 'success' | 'error'
  message: string
  url?: string
}

export default function ImageDropZone({ onUploaded, children }: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dragDepth = useRef(0)
  const toastId = useRef(0)

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  const uploadFile = useCallback(
    async (file: File) => {
      setPending(n => n + 1)
      try {
        const body = new FormData()
        body.append('image', file)
        const res = await fetch('/api/upload', { method: 'POST', body })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          pushToast({
            kind: 'error',
            message: data.error || `Upload failed for ${file.name}`,
          })
          return
        }

        if (data.link) {
          onUploaded(data.link as Link)
          pushToast({ kind: 'success', message: `${file.name} uploaded and saved`, url: data.image?.url })
        } else {
          pushToast({
            kind: 'success',
            message: data.warning || `${file.name} uploaded (not saved to vault)`,
            url: data.image?.url,
          })
        }
      } catch (error) {
        console.error('Image upload failed', error)
        pushToast({ kind: 'error', message: `Could not upload ${file.name}` })
      } finally {
        setPending(n => n - 1)
      }
    },
    [onUploaded, pushToast],
  )

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      const images = list.filter(f => f.type.startsWith('image/'))
      const rejected = list.length - images.length

      if (rejected > 0) {
        pushToast({ kind: 'error', message: 'Only image files can be uploaded' })
      }
      // Upload one at a time so the vault numbering stays in order.
      for (const image of images) {
        await uploadFile(image)
      }
    },
    [pushToast, uploadFile],
  )

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFiles])

  return (
    <>
      {children}

      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-blue-500 bg-gray-900/90 px-12 py-10 text-center shadow-2xl">
            <ImageUp className="h-10 w-10 text-blue-400" />
            <p className="text-lg font-semibold text-white">Drop to upload</p>
            <p className="text-sm text-gray-400">Images go to ImgBB and are saved to your vault</p>
          </div>
        </div>
      )}

      {pending > 0 && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          Uploading {pending} image{pending > 1 ? 's' : ''}...
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`rounded-lg border bg-gray-900 p-3 text-sm shadow-xl ${
              toast.kind === 'success' ? 'border-green-800' : 'border-red-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {toast.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              )}
              <p className="flex-1 break-words text-gray-200">{toast.message}</p>
              <button
                type="button"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-gray-500 hover:text-gray-300"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {toast.url && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(toast.url as string)}
                className="mt-2 flex w-full items-center gap-1.5 rounded bg-gray-800 px-2 py-1.5 text-xs text-blue-300 hover:bg-gray-700"
              >
                <Clipboard className="h-3 w-3" />
                <span className="truncate">{toast.url}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
