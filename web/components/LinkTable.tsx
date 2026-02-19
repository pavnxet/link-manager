'use client'

import { useState } from 'react'
import { ExternalLink, Edit2, Trash2, Check, X } from 'lucide-react'

export interface Link {
  id: string
  title: string
  page_title: string
  url: string
  category: string
  created_at: string
}

interface LinkTableProps {
  links: Link[]
  onUpdate: (id: string, data: Partial<Link>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function LinkTable({ links, onUpdate, onDelete }: LinkTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Link>>({})

  const startEdit = (link: Link) => {
    setEditingId(link.id)
    setEditForm({ title: link.title, page_title: link.page_title, category: link.category })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (id: string) => {
    await onUpdate(id, editForm)
    setEditingId(null)
    setEditForm({})
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-md">
      <table className="min-w-full divide-y divide-gray-700 bg-gray-800 text-sm">
        <thead className="bg-gray-900 text-gray-400">
          <tr>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs">Title / #</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs">Category</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs">Page Title</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs">URL</th>
            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-xs">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700 text-gray-300">
          {links.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No links found. Add one above to get started!
              </td>
            </tr>
          ) : (
            links.map((link) => (
              <tr key={link.id} className="hover:bg-gray-700/50 transition-colors">
                {editingId === link.id ? (
                  <>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="text"
                        value={editForm.title || ''}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full rounded bg-gray-600 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                       <input
                        type="text"
                        value={editForm.category || ''}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full rounded bg-gray-600 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <textarea
                        value={editForm.page_title || ''}
                        onChange={(e) => setEditForm({ ...editForm, page_title: e.target.value })}
                        rows={2}
                        className="w-full rounded bg-gray-600 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 align-top">
                        <div className="max-w-xs truncate" title={link.url}>{link.url}</div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(link.id)}
                          className="rounded p-1 text-green-400 hover:bg-gray-600 transition-colors"
                          title="Save"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded p-1 text-red-400 hover:bg-gray-600 transition-colors"
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-white align-top">{link.title}</td>
                    <td className="px-4 py-3 align-top">{link.category}</td>
                    <td className="px-4 py-3 align-top">
                        <div className="line-clamp-2" title={link.page_title}>{link.page_title}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 max-w-xs group"
                        title={link.url}
                      >
                        <span className="truncate">{link.url}</span>
                        <ExternalLink size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(link)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this link?')) {
                              onDelete(link.id)
                            }
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
