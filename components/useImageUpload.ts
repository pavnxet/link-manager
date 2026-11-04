'use client'

import { useCallback, useRef, useState } from 'react'
import type { Link } from './LinkTable'

export interface UploadToast {
  id: number
  kind: 'success' | 'error'
  message: string
  url?: string
}

/**
 * Shared image-upload state: the file picker button, drag-and-drop, progress and
 * toasts all go through this hook so there is a single upload queue.
 */
export function useImageUpload(onUploaded: (link: Link) => void) {
  const [pending, setPending] = useState(0)
  const [toasts, setToasts] = useState<UploadToast[]>([])
  const toastId = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const pushToast = useCallback((toast: Omit<UploadToast, 'id'>) => {
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
          pushToast({ kind: 'error', message: data.error || `Upload failed for ${file.name}` })
          return
        }

        if (data.link) {
          onUploaded(data.link as Link)
          pushToast({
            kind: 'success',
            message: `${file.name} uploaded and saved`,
            url: data.image?.url,
          })
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

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      const images = list.filter(f => f.type.startsWith('image/'))
      if (images.length !== list.length) {
        pushToast({ kind: 'error', message: 'Only image files can be uploaded' })
      }
      // One at a time, so the vault numbering stays in order.
      for (const image of images) {
        await uploadFile(image)
      }
    },
    [pushToast, uploadFile],
  )

  const openPicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = () => {
      if (input.files?.length) void uploadFiles(input.files)
    }
    input.click()
  }, [uploadFiles])

  return { pending, toasts, uploadFiles, openPicker, dismissToast }
}
