import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllQuestions, deleteQuestion, updateQuestion } from '../../lib/adminApi'
import { AREAS } from '../../data/areas'

const TYPE_LABELS = { multiple_choice: 'Multipla', kprim: 'K-PRIM' }
const STATUS_COLORS = {
  active: 'bg-secondary-container text-on-secondary-container',
  draft: 'bg-tertiary-fixed/50 text-on-tertiary-fixed',
  archived: 'bg-surface-container-high text-outline',
}

export default function AdminQuestions() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  useEffect(() => {
    getAllQuestions({ pageSize: 2000 })
      .then(({ data }) => { setQuestions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Eliminare questa domanda?')) return
    await deleteQuestion(id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handlePublish(id, e) {
    e.stopPropagation()
    try {
      await updateQuestion(id, { status: 'active' })
      setQuestions(prev => prev.map(q => (q.id === id ? { ...q, status: 'active' } : q)))
    } catch { /* ignore */ }
  }

  // Bulk selection
  const filtered = questions.filter(q => {
    if (filterArea && q.area != filterArea) return false
    if (filterType && q.type !== filterType) return false
    if (filterStatus && q.status !== filterStatus) return false
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredIds = new Set(filtered.map(q => q.id))
  const allSelected = filtered.length > 0 && filtered.every(q => selected.has(q.id))
  const someSelected = filtered.some(q => selected.has(q.id))
  const selectedInFilter = [...selected].filter(id => filteredIds.has(id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(q => n.delete(q.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(q => n.add(q.id)); return n })
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  async function handleBulkStatus(newStatus) {
    if (!selectedInFilter.length) return
    const label = newStatus === 'archived' ? 'archiviare' : newStatus === 'draft' ? 'spostare in bozze' : 'pubblicare'
    if (!confirm(`Confermi di ${label} ${selectedInFilter.length} domande?`)) return
    setBulkUpdating(true)
    let done = 0
    for (const id of selectedInFilter) {
      try {
        await updateQuestion(id, { status: newStatus })
        done++
      } catch { /* skip errors */ }
    }
    setQuestions(prev => prev.map(q => selected.has(q.id) ? { ...q, status: newStatus } : q))
    setSelected(new Set())
    setBulkUpdating(false)
  }

  async function handleBulkDelete() {
    if (!selectedInFilter.length) return
    if (!confirm(`⚠️ Eliminare ${selectedInFilter.length} domande? Operazione irreversibile.`)) return
    setBulkUpdating(true)
    let done = 0
    for (const id of selectedInFilter) {
      try { await deleteQuestion(id); done++ } catch { /* skip */ }
    }
    setQuestions(prev => prev.filter(q => !selected.has(q.id)))
    setSelected(new Set())
    setBulkUpdating(false)
  }

  const draftCount = questions.filter(q => q.status === 'draft').length

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Domande</h2>
            <p className="text-sm text-secondary">{questions.length} domande nel database</p>
          </div>
          <div className="flex items-center gap-3">
            {draftCount > 0 && (
              <button
                onClick={() => setFilterStatus(filterStatus === 'draft' ? '' : 'draft')}
                className={`text-sm px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  filterStatus === 'draft'
                    ? 'bg-tertiary text-on-tertiary'
                    : 'bg-tertiary-fixed/50 text-on-tertiary-fixed hover:bg-tertiary-fixed'
                }`}
              >
                Da revisionare: {draftCount}
              </button>
            )}
            <button className="btn-primary" onClick={() => navigate('/admin/questions/new')}>
              + Nuova domanda
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Cerca testo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1 min-w-48"
          />
          <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="input">
            <option value="">Tutte le aree</option>
            {Object.entries(AREAS).map(([k, v]) => (
              <option key={k} value={k}>R{k} – {v.name}</option>
            ))}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input">
            <option value="">Tutti i tipi</option>
            <option value="multiple_choice">Multipla scelta</option>
            <option value="kprim">K-PRIM</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input">
            <option value="">Tutti gli stati</option>
            <option value="active">Attive</option>
            <option value="draft">Bozze</option>
            <option value="archived">Archiviate</option>
          </select>
        </div>

        {/* Bulk actions bar */}
        {selectedInFilter.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-primary">
              {selectedInFilter.length} selezionate
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleBulkStatus('active')}
                disabled={bulkUpdating}
                className="px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold hover:bg-secondary/20 disabled:opacity-50"
              >
                Pubblica
              </button>
              <button
                onClick={() => handleBulkStatus('draft')}
                disabled={bulkUpdating}
                className="px-3 py-1.5 bg-tertiary-fixed/50 text-on-tertiary-fixed rounded-full text-xs font-bold hover:bg-tertiary-fixed disabled:opacity-50"
              >
                Sposta in bozze
              </button>
              <button
                onClick={() => handleBulkStatus('archived')}
                disabled={bulkUpdating}
                className="px-3 py-1.5 bg-surface-container-high text-outline rounded-full text-xs font-bold hover:bg-surface-container-highest disabled:opacity-50"
              >
                Archivia
              </button>
              <span className="text-outline-variant">|</span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkUpdating}
                className="px-3 py-1.5 bg-error/10 text-error rounded-full text-xs font-bold hover:bg-error/20 disabled:opacity-50"
              >
                Elimina
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-outline hover:text-on-surface ml-2"
              >
                Deseleziona
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card animate-pulse h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12 text-secondary">Nessuna domanda trovata</div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-xs text-outline uppercase">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => el && (el.indeterminate = someSelected && !allSelected)}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Testo</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Area</th>
                  <th className="px-4 py-3 text-left">Stato</th>
                  <th className="px-4 py-3 text-left">Expert</th>
                  <th className="px-4 py-3 text-left">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map(q => (
                  <tr
                    key={q.id}
                    className={`hover:bg-surface-container-low transition-colors ${selected.has(q.id) ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={() => toggleOne(q.id)}
                        onClick={e => e.stopPropagation()}
                        className="cursor-pointer"
                      />
                    </td>
                    <td
                      className="px-4 py-3 max-w-xs cursor-pointer"
                      onClick={() => navigate(`/admin/questions/${q.id}`)}
                    >
                      <p className="truncate text-on-surface">{q.text}</p>
                      {q.topic && <p className="text-xs text-outline">{q.topic}</p>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{TYPE_LABELS[q.type] || q.type}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                        R{q.area}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] || 'bg-surface-container-high text-outline'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`material-symbols-outlined text-[18px] ${q.expert_approved ? 'text-green-600' : 'text-outline/40'}`}>
                        {q.expert_approved ? 'verified' : 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {q.status === 'draft' && (
                          <button
                            onClick={e => handlePublish(q.id, e)}
                            className="text-primary hover:text-primary/80 text-xs font-medium"
                          >
                            Pubblica
                          </button>
                        )}
                        <button
                          onClick={e => handleDelete(q.id, e)}
                          className="text-error hover:text-error/80 text-xs font-medium"
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
