import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { fetchAreas, getAreaQuestionCounts } from '../../lib/adminApi'

export default function AdminAreas() {
  const navigate = useNavigate()
  const [areas, setAreas] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchAreas(), getAreaQuestionCounts()])
      .then(([a, c]) => { setAreas(a); setCounts(c); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="font-headline font-bold text-2xl text-on-surface">Aree</h2>
          <p className="text-sm text-secondary">Gestione 9 aree FPH: metadati, learning objectives e topics</p>
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
                        Area {area.role_number || area.id}
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
      </div>
    </AdminLayout>
  )
}
