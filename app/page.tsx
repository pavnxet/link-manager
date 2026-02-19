'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import LinkTable, { Link } from '@/components/LinkTable'
import AddLinkForm from '@/components/AddLinkForm'
import BackupRestore from '@/components/BackupRestore'

export default function Dashboard() {
  const [links, setLinks] = useState<Link[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLinks(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleUpdate = async (id: string, data: Partial<Link>) => {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setLinks(links.map(l => l.id === id ? { ...l, ...data } : l))
      }
    } catch (error) {
      console.error('Failed to update link', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setLinks(links.filter(l => l.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete link', error)
    }
  }

  const handleLinkAdded = (newLink: Link) => {
    // Add to top if using created_at DESC, or just unshift
    setLinks([newLink, ...links])
  }

  const handleRestoreComplete = () => {
      fetchLinks(searchQuery)
      setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
             <h1 className="text-3xl font-bold tracking-tight text-white">Link Vault</h1>
             <p className="text-gray-400 mt-1">Personal Knowledge Hub</p>
          </div>
          <div className="flex items-center gap-4">
            <BackupRestore onRestoreComplete={handleRestoreComplete} />
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
    </div>
  )
}
