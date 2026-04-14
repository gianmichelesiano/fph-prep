import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { fetchAreas, updateArea, fetchNotebooks, createNotebook, updateNotebook, deleteNotebook } from '../../lib/adminApi'

const TABS = ['Areas', 'Notebooks']

export default function AdminCatalog() {
  const [tab, setTab] = useState('Areas')
  const [areas, setAreas] = useState([])
  const [notebooks, setNotebooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchAreas(), fetchNotebooks()])
      .then(([a, n]) => { setAreas(a); setNotebooks(n) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="font-headline font-bold text-2xl text-on-surface">Catalog</h2>
          <p className="text-sm text-secondary">Gestisci aree e notebook NotebookLM</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 border-b border-outline-variant/20">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-error-container text-error rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-outline">Caricamento...</div>
        ) : (
          <>
            {tab === 'Areas' && (
              <AreasTab areas={areas} onUpdate={updated => setAreas(prev => prev.map(a => a.id === updated.id ? updated : a))} />
            )}
            {tab === 'Notebooks' && (
              <NotebooksTab
                notebooks={notebooks}
                areas={areas}
                onAdd={nb => setNotebooks(prev => [...prev, nb])}
                onUpdate={updated => setNotebooks(prev => prev.map(n => n.id === updated.id ? updated : n))}
                onDelete={id => setNotebooks(prev => prev.filter(n => n.id !== id))}
              />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function AreasTab({ areas, onUpdate }) {
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(area) {
    setEditing(area.id)
    setEditName(area.name)
  }

  async function saveEdit(area) {
    setSaving(true)
    try {
      const updated = await updateArea(area.id, { name: editName })
      onUpdate(updated)
      setEditing(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/20 text-outline text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3 w-12">ID</th>
            <th className="text-left px-4 py-3">Nome</th>
            <th className="text-left px-4 py-3">Badge</th>
            <th className="text-left px-4 py-3 w-24">Domande</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {areas.map(area => (
            <tr key={area.id} className="border-b border-outline-variant/10 hover:bg-surface-container transition-colors">
              <td className="px-4 py-3 font-mono text-outline">{area.id}</td>
              <td className="px-4 py-3">
                {editing === area.id ? (
                  <input
                    autoFocus
                    className="input w-full"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(area); if (e.key === 'Escape') setEditing(null) }}
                  />
                ) : (
                  <span className="font-medium text-on-surface">{area.name}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${area.color_class || 'bg-surface-container-high text-on-surface-variant'}`}>
                  R{area.id}
                </span>
              </td>
              <td className="px-4 py-3 text-outline">{area.questions_count ?? '–'}</td>
              <td className="px-4 py-3">
                {editing === area.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(area)}
                      disabled={saving}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      Salva
                    </button>
                    <button onClick={() => setEditing(null)} className="text-xs text-outline hover:underline">
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(area)} className="material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors">
                    edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NotebooksTab() {
  return <div className="text-sm text-outline">Notebooks tab — coming in Task 4</div>
}
