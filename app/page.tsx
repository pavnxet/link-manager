'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImageUp, LogOut, Search } from 'lucide-react'
import LinkTable, { Link } from '@/components/LinkTable'
import AddLinkForm from '@/components/AddLinkForm'
import BackupRestore from '@/components/BackupRestore'
import ImageDropZone from '@/components/ImageDropZone'
import CameraCapture from '@/components/CameraCapture'
import { useImageUpload } from '@/components/useImageUpload'

export default function Dashboard() {
  const [links, setLinks] = useState<Link[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [cameraOpen, setCameraOpen] = useState(false)
  const router = useRouter()
  const skipFirstSearch = useRef(true)

  const fetchLinks = async (query = '') => {
    setLoading(true)
    try {
      const url = query ? `/api/links?q=${encodeURIComponent(query)}` : '/api/links'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLinks(data)
      }
    } catch (error) {
      console.error('Failed to fetch links', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchLinks()
  }, [])

  // Debounce search. The first run is skipped: the effect above already fetched on mount, so
  // this used to fire a second identical request 500 ms later on every page load.
  useEffect(() => {
    if (skipFirstSearch.current) {
      skipFirstSearch.current = false
      return
    }
    const timer = setTimeout(() => {
      fetchLinks(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Returns whether the save landed: the table used to close the editor either way, so a failed
  // PUT looked like a successful edit until the page was reloaded.
  const handleUpdate = async (id: string, data: Partial<Link>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to update link', err)
        return false
      }
      const updated = await res.json().catch(() => null)
      setLinks(prev =>
        prev.map(l => (l.id === id ? { ...l, ...data, ...(updated && updated.id ? updated : {}) } : l)),
      )
      return true
    } catch (error) {
      console.error('Failed to update link', error)
      return false
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLinks(prev => prev.filter(l => l.id !== id))
      } else {
        console.error('Failed to delete link', await res.json().catch(() => ({})))
      }
    } catch (error) {
      console.error('Failed to delete link', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/login')
    router.refresh()
  }

  const handleLinkAdded = (newLink: Link) => {
    // Add to top if using created_at DESC, or just unshift
    setLinks(prev => [newLink, ...prev])
  }

  const handleRestoreComplete = () => {
      fetchLinks(searchQuery)
      setRefreshTrigger(prev => prev + 1)
  }

  const { pending, toasts, uploadFiles, openPicker, dismissToast } = useImageUpload(handleLinkAdded)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans">
      <ImageDropZone
        onFiles={uploadFiles}
        pending={pending}
        toasts={toasts}
        onDismiss={dismissToast}
      >
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
             <h1 className="text-3xl font-bold tracking-tight text-white">Link Vault</h1>
             <p className="text-gray-400 mt-1">Personal Knowledge Hub · drop, paste or shoot an image</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={pending > 0}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-blue-600 hover:text-white disabled:opacity-50"
              title="Take a photo with the camera"
            >
              <Camera className="h-4 w-4" />
              Camera
            </button>
            <button
              type="button"
              onClick={() => openPicker()}
              disabled={pending > 0}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-blue-600 hover:text-white disabled:opacity-50"
            >
              <ImageUp className="h-4 w-4" />
              Upload Image
            </button>
            <BackupRestore onRestoreComplete={handleRestoreComplete} />
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-red-700 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        {/* Add Link Form */}
        <AddLinkForm onLinkAdded={handleLinkAdded} refreshTrigger={refreshTrigger} />

        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search links by title, URL, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-gray-900 py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
            />
          </div>

          {loading && links.length === 0 ? (
             <div className="text-center py-12 text-gray-500 animate-pulse">Loading your vault...</div>
          ) : (
            <LinkTable links={links} onUpdate={handleUpdate} onDelete={handleDelete} />
          )}
        </div>
      </div>
      </ImageDropZone>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={file => void uploadFiles([file])}
        onFallback={() => openPicker('environment')}
      />
    </div>
  )
}
