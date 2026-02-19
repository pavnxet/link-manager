'use client'

import { useState, useRef } from 'react'
import { Download, Upload, Loader2 } from 'lucide-react'

interface BackupRestoreProps {
  onRestoreComplete: () => void
}

export default function BackupRestore({ onRestoreComplete }: BackupRestoreProps) {
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownload = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/backup')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `link-vault-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
          alert('Failed to download backup.')
      }
    } catch (error) {
      console.error('Download failed', error)
      alert('Backup download failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (window.confirm('Restoring will merge links into your vault. Existing URLs will be skipped. Continue?')) {
        setLoading(true)
        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string
                const json = JSON.parse(content)

                const res = await fetch('/api/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json)
                })

                if (res.ok) {
                    const data = await res.json()
                    alert(`Restore complete! ${data.count} links processed.`)
                    onRestoreComplete()
                } else {
                    const err = await res.json()
                    alert(`Restore failed: ${err.error || 'Unknown error'}`)
                }
            } catch (err) {
                console.error('Restore error', err)
                alert('Invalid JSON file or corrupted data.')
            } finally {
                setLoading(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        }
        reader.readAsText(file)
    } else {
        if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-3 py-2 rounded-md text-sm transition-colors border border-gray-800 hover:border-gray-700"
        title="Download Backup"
      >
        <Download size={16} />
        <span className="hidden sm:inline">Backup</span>
      </button>

      <div className="relative">
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
        />
        <button
            onClick={handleUploadClick}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-3 py-2 rounded-md text-sm transition-colors border border-gray-800 hover:border-gray-700"
            title="Restore from Backup"
        >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="hidden sm:inline">Restore</span>
        </button>
      </div>
    </div>
  )
}
