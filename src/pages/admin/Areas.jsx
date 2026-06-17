import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { fetchAreas, getAreaQuestionCounts } from '../../lib/adminApi'
import { fetchAreaContentStatus } from '../../lib/adminBackendApi'

// Determina badge "Pronto" / "In lavorazione" / "Da alimentare" dalla risposta
// del backend. Funziona anche se i campi sono parzialmente presenti.
function resolveReadinessBadge(status) {
  if (!status) return null
  const total = status.total_topics ?? 0
  const noSources = status.topics_without_sources ?? 0
  const complete = status.complete_topics ?? 0

  if (total === 0) return { label: 'Da alimentare', cls: 'bg-error-container text-error' }
  if (noSources === total) return { label: 'Da alimentare', cls: 'bg-error-container text-error' }
  if (complete === total) return { label: 'Pronto', cls: 'bg-tertiary-container text-on-tertiary-container' }
  return { label: 'In lavorazione', cls: 'bg-secondary-container text-on-secondary-container' }
}

export default function AdminAreas() {
  const navigate = useNavigate()
  const [areas, setAreas] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Content-status dal backend locale FastAPI (porta 8005)
  const [contentStatus, setContentStatus] = useState({})
  const [backendUnavailable, setBackendUnavailable] = useState(false)
  const statusLoading = !loading && areas.length > 0 && Object.keys(contentStatus).length === 0 && !backendUnavailable

  useEffect(() => {
    Promise.all([fetchAreas(), getAreaQuestionCounts()])
      .then(([a, c]) => { setAreas(a); setCounts(c); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Carica content-status per ogni area in parallelo dopo che le aree sono pronte
  useEffect(() => {
    if (areas.length === 0) return
    let cancelled = false
    Promise.all(
      areas.map(area =>
        fetchAreaContentStatus(area.id).then(data => ({ id: area.id, data }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      let allNull = true
      results.forEach(({ id, data }) => {
        map[id] = data
        if (data !== null) allNull = false
      })
      setContentStatus(map)
      setBackendUnavailable(allNull)
    })
    return () => { cancelled = true }
  }, [areas])

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="font-headline font-bold text-2xl text-on-surface">Ruoli</h2>
          <p className="text-sm text-secondary">Gestione {areas.length} ruoli FPH: metadati, learning objectives e topics</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-error-container text-error rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-outline">Caricamento...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map(area => {
              const qCount = counts[area.id] || 0
              const isHighlighted = area.role_number === 4
              return (
                <button
                  key={area.id}
                  onClick={() => navigate(`/admin/areas/${area.id}`)}
                  className={`text-left p-5 rounded-xl border transition-colors hover:shadow-md ${
                    isHighlighted
                      ? 'border-primary/30 bg-primary/5 ring-2 ring-primary/20'
                      : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color_class || 'bg-surface-container-high text-on-surface-variant'}`}>
                        Ruolo {area.role_number || area.id}
                      </div>
                      <h3 className="font-semibold text-on-surface mt-2">{area.name}</h3>
                    </div>
                    {isHighlighted && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">50% esame</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-on-surface">{area.weight_percent ?? '–'}%</div>
                      <div className="text-[10px] text-outline uppercase">Peso</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-on-surface">{qCount}</div>
                      <div className="text-[10px] text-outline uppercase">Domande</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-on-surface">{area.study_days ?? '–'}</div>
                      <div className="text-[10px] text-outline uppercase">Giorni</div>
                    </div>
                  </div>

                  {area.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{area.description}</p>
                  )}

                  <div className="w-full bg-surface-container-high rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, qCount > 0 ? Math.round((qCount / (area.questions_count || 1)) * 100) : 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-outline mt-1">
                    {qCount}/{area.questions_count || '?'} domande
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ===== SEZIONE STATO CONTENUTI (backend locale FastAPI) ===== */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-headline font-semibold text-lg text-on-surface">Stato contenuti</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-container-high text-outline">
              backend locale
            </span>
            {statusLoading && (
              <span className="text-xs text-outline animate-pulse">Caricamento...</span>
            )}
          </div>

          {backendUnavailable && !statusLoading ? (
            <div className="px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-outline">
              Backend non disponibile — avvia il server FastAPI su{' '}
              <code className="font-mono text-xs bg-surface-container-high px-1 py-0.5 rounded">
                {import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8005'}
              </code>
            </div>
          ) : !loading && !statusLoading && (
            <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/20">
                    <th className="text-left px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Ruolo</th>
                    <th className="text-center px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Topic totali</th>
                    <th className="text-center px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Completi</th>
                    <th className="text-center px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Senza fonti</th>
                    <th className="text-center px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Avanzamento</th>
                    <th className="text-center px-4 py-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area, idx) => {
                    const s = contentStatus[area.id]
                    const badge = resolveReadinessBadge(s)
                    const total = s?.total_topics ?? 0
                    const complete = s?.complete_topics ?? 0
                    const noSources = s?.topics_without_sources ?? 0
                    const pct = total > 0 ? Math.round((complete / total) * 100) : 0

                    return (
                      <tr
                        key={area.id}
                        className={`border-b border-outline-variant/10 last:border-0 ${
                          idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color_class || 'bg-surface-container-high text-on-surface-variant'}`}>
                              R{area.role_number || area.id}
                            </div>
                            <span className="text-on-surface font-medium truncate max-w-[180px]">{area.name}</span>
                          </div>
                        </td>

                        {s === undefined ? (
                          /* still loading this row */
                          <td colSpan={5} className="px-4 py-3 text-center text-outline text-xs animate-pulse">
                            caricamento...
                          </td>
                        ) : s === null ? (
                          /* backend non raggiungibile per quest'area */
                          <td colSpan={5} className="px-4 py-3 text-center text-outline text-xs">
                            —
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-center text-on-surface font-semibold">{total}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${complete === total && total > 0 ? 'text-tertiary' : 'text-on-surface'}`}>
                                {complete}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${noSources > 0 ? 'text-error' : 'text-on-surface'}`}>
                                {noSources}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-surface-container-high rounded-full h-1.5 min-w-[60px]">
                                  <div
                                    className="bg-primary h-1.5 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-outline w-7 text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {badge && (
                                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
