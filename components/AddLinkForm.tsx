'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Link } from './LinkTable'

interface AddLinkFormProps {
  onLinkAdded: (link: Link) => void
  refreshTrigger: number
}

export default function AddLinkForm({ onLinkAdded, refreshTrigger }: AddLinkFormProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)

  // Fetch next ID on mount and when refreshTrigger changes
  useEffect(() => {
    fetchNextId()
  }, [refreshTrigger])

  const fetchNextId = async () => {
    try {
      const res = await fetch('/api/links/next-id')
      if (res.ok) {
        const data = await res.json()
        setTitle(data.nextId.toString())
      }
    } catch (error) {
      console.error('Failed to fetch next ID', error)
    }
  }

  const handleUrlPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedUrl = e.clipboardData.getData('text')
    // Wait for state update or use pastedUrl directly
    if (pastedUrl) scrapeUrl(pastedUrl)
  }

  const handleUrlBlur = () => {
      if (url) scrapeUrl(url)
  }

  const scrapeUrl = async (linkUrl: string) => {
    // Basic validation to avoid scraping incomplete URLs
    if (!linkUrl || !linkUrl.startsWith('http')) return

    // Prevent double scraping if already scraping same URL (simple check)
    if (scraping) return

    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.title) setPageTitle(data.title)
        if (data.category) setCategory(data.category)
      }
    } catch (error) {
      console.error('Scrape failed', error)
    } finally {
      setScraping(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url || !title) return

    setLoading(true)
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title,
          page_title: pageTitle,
          category,
        }),
      })

      if (res.ok) {
        const newLink = await res.json()
        onLinkAdded(newLink)
        // Reset form
        setUrl('')
        setPageTitle('')
        setCategory('')
        fetchNextId() // Get next ID for next entry
      } else {
          const err = await res.json()
          alert(`Failed to save link: ${err.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Save failed', error)
      alert('An error occurred while saving.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-lg border border-gray-800 space-y-4 shadow-sm transition-all hover:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Title / ID Input */}
        <div className="md:col-span-2">
          <label htmlFor="title" className="block text-xs font-medium text-gray-400 mb-1">
            Title / #
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors placeholder-gray-600"
            placeholder="#"
          />
        </div>

        {/* URL Input */}
        <div className="md:col-span-10">
          <label htmlFor="url" className="block text-xs font-medium text-gray-400 mb-1">
            URL
          </label>
          <div className="relative">
             <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={handleUrlPaste}
                onBlur={handleUrlBlur}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors placeholder-gray-600"
                placeholder="Paste URL here..."
                autoFocus
                required
            />
            {scraping && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
                </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* Page Title (Auto-filled) */}
         <div>
            <label htmlFor="pageTitle" className="block text-xs font-medium text-gray-400 mb-1">
                Page Title (Auto)
            </label>
            <input
                id="pageTitle"
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm transition-colors placeholder-gray-600"
                placeholder="Webpage title..."
            />
         </div>

          {/* Category (Auto-filled) */}
         <div>
            <label htmlFor="category" className="block text-xs font-medium text-gray-400 mb-1">
                Category (Auto)
            </label>
            <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm transition-colors placeholder-gray-600"
                placeholder="Emoji & Hashtag"
            />
         </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
            type="submit"
            disabled={loading || !url || !title}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
        >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Save Link
        </button>
      </div>
    </form>
  )
}
