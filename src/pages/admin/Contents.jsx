import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { AREAS } from '../../data/areas'
import { fetchAllNotebooksAdmin } from '../../lib/notebookContentsApi'

export default function AdminContents() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterArea, setFilterArea] = useState('all')

  useEffect(() => {
    fetchAllNotebooksAdmin('it')
      .then(data => { setItems(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (filterArea === 'all') return items
    return items.filter(i => i.area_id === Number(filterArea))
  }, [items, filterArea])

  const stats = useMemo(() => {
    const total = items.length
    const withContent = items.filter(i => i.hasContent).length
    return { total, withContent }
  }, [items])

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">Contents</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {stats.withContent}/{stats.total} notebook con contenuto (IT)
            </p>
          </div>
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            className="px-3 py-2 bg-surface-container rounded-lg text-sm"
          >
            <option value="all">Tutte le aree</option>
            {Object.entries(AREAS).map(([id, a]) => (
              <option key={id} value={id}>Area {id} — {a.name}</option>
            ))}
          </select>
        </header>

        {loading ? (
          <div className="text-on-surface-variant">Caricamento...</div>
        ) : (
          <div className="rounded-xl bg-surface-container-lowest overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-left text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">Key</th>
                  <th className="px-4 py-3 font-semibold">Titolo</th>
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 font-semibold">Stato</th>
                  <th className="px-4 py-3 font-semibold">Free</th>
                  <th className="px-4 py-3 font-semibold">Aggiornato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map(n => (
                  <tr
                    key={n.id}
                    className="hover:bg-surface-container-low cursor-pointer"
                    onClick={() => navigate(`/admin/contents/${n.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{n.key}</td>
                    <td className="px-4 py-3 text-on-surface">{n.title}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{n.area_id}</td>
                    <td className="px-4 py-3">
                      {n.hasContent ? (
                        <span className="text-xs font-semibold text-green-700">✓ Pronto</span>
                      ) : (
                        <span className="text-xs text-outline">✗ Vuoto</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {n.hasContent && n.isFree ? (
                        <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10">Free</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('it-IT') : '—'}
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
