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

const EMPTY_NB = { id: '', key: '', title: '', area_id: '', argomento: '' }

function NotebooksTab({ notebooks, areas, onAdd, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [editFields, setEditFields] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newNb, setNewNb] = useState(EMPTY_NB)
  const [busy, setBusy] = useState(false)

  function areaColor(areaId) {
    const area = areas.find(a => a.id === areaId)
    return area?.color_class || 'bg-surface-container-high text-on-surface-variant'
  }

  function startEdit(nb) {
    setEditingId(nb.id)
    setEditFields({ title: nb.title, argomento: nb.argomento || '', area_id: nb.area_id || '' })
  }

  async function saveEdit(nb) {
    setBusy(true)
    try {
      const updated = await updateNotebook(nb.id, {
        title: editFields.title,
        argomento: editFields.argomento || null,
        area_id: editFields.area_id ? Number(editFields.area_id) : null,
      })
      onUpdate(updated)
      setEditingId(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAreaChange(nb, areaId) {
    try {
      const updated = await updateNotebook(nb.id, { area_id: areaId ? Number(areaId) : null })
      onUpdate(updated)
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleDelete(nb) {
    if (!confirm(`Eliminare il notebook "${nb.title}"?`)) return
    setBusy(true)
    try {
      await deleteNotebook(nb.id)
      onDelete(nb.id)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd() {
    if (!newNb.id || !newNb.title) { alert('UUID e titolo sono obbligatori'); return }
    setBusy(true)
    try {
      const created = await createNotebook({
        id: newNb.id,
        key: newNb.key || null,
        title: newNb.title,
        area_id: newNb.area_id ? Number(newNb.area_id) : null,
        argomento: newNb.argomento || null,
      })
      onAdd(created)
      setNewNb(EMPTY_NB)
      setShowAdd(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary text-sm" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? 'Annulla' : '+ Aggiungi notebook'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-outline mb-1 block">UUID NotebookLM *</label>
            <input className="input w-full" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={newNb.id} onChange={e => setNewNb(p => ({ ...p, id: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-outline mb-1 block">Key (es. fitoterapia)</label>
            <input className="input w-full" placeholder="chiave_yaml" value={newNb.key} onChange={e => setNewNb(p => ({ ...p, key: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-outline mb-1 block">Titolo *</label>
            <input className="input w-full" placeholder="Titolo notebook" value={newNb.title} onChange={e => setNewNb(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-outline mb-1 block">Area</label>
            <select className="input w-full" value={newNb.area_id} onChange={e => setNewNb(p => ({ ...p, area_id: e.target.value }))}>
              <option value="">— nessuna —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.id} – {a.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-outline mb-1 block">Argomento</label>
            <input className="input w-full" placeholder="argomenti, parole chiave..." value={newNb.argomento} onChange={e => setNewNb(p => ({ ...p, argomento: e.target.value }))} />
          </div>
          <div className="col-span-2 flex justify-end">
            <button className="btn-primary text-sm" onClick={handleAdd} disabled={busy}>
              {busy ? 'Salvataggio...' : 'Salva notebook'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-outline text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 w-32">Key</th>
              <th className="text-left px-4 py-3">Titolo</th>
              <th className="text-left px-4 py-3 w-48">Area</th>
              <th className="text-left px-4 py-3">Argomento</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {notebooks.map(nb => (
              <tr key={nb.id} className="border-b border-outline-variant/10 hover:bg-surface-container transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-outline">{nb.key || '–'}</td>
                <td className="px-4 py-3">
                  {editingId === nb.id ? (
                    <input
                      autoFocus
                      className="input w-full"
                      value={editFields.title}
                      onChange={e => setEditFields(p => ({ ...p, title: e.target.value }))}
                    />
                  ) : (
                    <span className="font-medium text-on-surface">{nb.title}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === nb.id ? (
                    <select
                      className="input w-full"
                      value={editFields.area_id}
                      onChange={e => setEditFields(p => ({ ...p, area_id: e.target.value }))}
                    >
                      <option value="">— nessuna —</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.id} – {a.name}</option>)}
                    </select>
                  ) : (
                    <select
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${areaColor(nb.area_id)}`}
                      value={nb.area_id || ''}
                      onChange={e => handleAreaChange(nb, e.target.value || null)}
                    >
                      <option value="">— nessuna —</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.id} – {a.name}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-outline text-xs max-w-xs">
                  {editingId === nb.id ? (
                    <input
                      className="input w-full"
                      value={editFields.argomento}
                      onChange={e => setEditFields(p => ({ ...p, argomento: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(nb); if (e.key === 'Escape') setEditingId(null) }}
                    />
                  ) : (
                    <span className="truncate block max-w-xs">{nb.argomento || '–'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === nb.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(nb)} disabled={busy} className="text-xs text-primary hover:underline disabled:opacity-50">Salva</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-outline hover:underline">Annulla</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(nb)} className="material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors">edit</button>
                      <button onClick={() => handleDelete(nb)} disabled={busy} className="material-symbols-outlined text-[18px] text-outline hover:text-error transition-colors disabled:opacity-30">delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
