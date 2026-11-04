'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clipboard, ImageUp, Loader2, X, XCircle } from 'lucide-react'
import { collectClipboardImages } from '@/lib/clipboard'
import type { UploadToast } from './useImageUpload'

interface ImageDropZoneProps {
  /** Receives dropped files. */
  onFiles: (files: FileList | File[]) => void
  /** Number of uploads currently in flight. */
  pending: number
  toasts: UploadToast[]
  onDismiss: (id: number) => void
  children: React.ReactNode
}

/**
 * Makes the whole dashboard a drop target for images (and a paste target for
 * clipboard images) and renders upload feedback. The trigger button and upload
 * logic live in `useImageUpload`.
 */
export default function ImageDropZone({
  onFiles,
  pending,
  toasts,
  onDismiss,
  children,
}: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

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
      if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files)
    }

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items?.length) return
      const images = collectClipboardImages(items)
      // Pasting text into a field must keep working, so only intercept when the
      // clipboard actually holds an image.
      if (images.length === 0) return
      e.preventDefault()
      onFiles(images)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [onFiles])

  return (
    <>
      {children}

      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-blue-500 bg-gray-900/90 px-12 py-10 text-center shadow-2xl">
            <ImageUp className="h-10 w-10 text-blue-400" />
            <p className="text-lg font-semibold text-white">Drop to upload</p>
            <p className="text-sm text-gray-400">Images go to ImgBB and are saved to your vault</p>
            <p className="text-xs text-gray-500">Tip: Ctrl+V also works</p>
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
                onClick={() => onDismiss(toast.id)}
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
                <Clipboard className="h-3 w-3 shrink-0" />
                <span className="truncate">{toast.url}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
