import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllQuestions, deleteQuestion } from '../../lib/adminApi'
import { AREAS } from '../../data/areas'

const TYPE_LABELS = { multiple: 'Multipla', truefalse: 'K-PRIM' }
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

  useEffect(() => {
    getAllQuestions()
      .then(({ data }) => { setQuestions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Eliminare questa domanda?')) return
    await deleteQuestion(id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const filtered = questions.filter(q => {
    if (filterArea && q.area != filterArea) return false
    if (filterType && q.type !== filterType) return false
    if (filterStatus && q.status !== filterStatus) return false
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Domande</h2>
            <p className="text-sm text-secondary">{questions.length} domande nel database</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/admin/questions/new')}>
            + Nuova domanda
          </button>
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
            <option value="multiple">Multipla scelta</option>
            <option value="truefalse">K-PRIM</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input">
            <option value="">Tutti gli stati</option>
            <option value="active">Attive</option>
            <option value="draft">Bozze</option>
            <option value="archived">Archiviate</option>
          </select>
        </div>

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
                  <th className="px-4 py-3 text-left">Testo</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Area</th>
                  <th className="px-4 py-3 text-left">Stato</th>
                  <th className="px-4 py-3 text-left">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map(q => (
                  <tr
                    key={q.id}
                    className="hover:bg-surface-container-low cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/questions/${q.id}`)}
                  >
                    <td className="px-4 py-3 max-w-xs">
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
                      <button
                        onClick={e => handleDelete(q.id, e)}
                        className="text-error hover:text-error/80 text-xs font-medium"
                      >
                        Elimina
                      </button>
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
