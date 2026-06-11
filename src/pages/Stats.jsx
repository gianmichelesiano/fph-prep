import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { fetchUserSessions } from '../lib/api'
import { fetchAreasWithProgress, fetchAllAreaProgress } from '../lib/areasApi'
import UserLayout from '../components/UserLayout'

export default function Stats() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [areas, setAreas] = useState([])
  const [areaProgress, setAreaProgress] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetchUserSessions(user.id),
      fetchAreasWithProgress().catch(() => []),
      fetchAllAreaProgress().catch(() => []),
    ])
      .then(([s, a, p]) => {
        setSessions(s)
        setAreas(a)
        setAreaProgress(p)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user])

  const completed = sessions.filter(s => s.status === 'completed')
  const totalDone = completed.length
  const totalQuestions = completed.reduce((sum, s) => sum + (s.total || 0), 0)
  const totalCorrect = completed.reduce((sum, s) => sum + (s.score || 0), 0)
  const globalPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

  const progressMap = {}
  areaProgress.forEach(p => { progressMap[p.area_id] = p })

  // Previsione esame: media accuratezza pesata sui pesi d'esame delle aree
  // con dati. La soglia FPH è 67/100.
  const PASS_THRESHOLD = 67
  const weighted = areas.reduce(
    (acc, area) => {
      const p = progressMap[area.id]
      const weight = area.weight_percent || 0
      if ((p?.questions_completed || 0) > 0 && weight > 0) {
        const pct = (p.questions_correct / p.questions_completed) * 100
        acc.score += weight * pct
        acc.coveredWeight += weight
        if (pct < PASS_THRESHOLD) {
          acc.gaps.push({ area, pct: Math.round(pct), lostPoints: (weight * (PASS_THRESHOLD - pct)) / 100 })
        }
      }
      return acc
    },
    { score: 0, coveredWeight: 0, gaps: [] }
  )
  const predictedScore = weighted.coveredWeight > 0
    ? Math.round(weighted.score / weighted.coveredWeight)
    : null
  const coverage = weighted.coveredWeight
  const topGaps = weighted.gaps.sort((a, b) => b.lostPoints - a.lostPoints).slice(0, 3)

  return (
    <UserLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        <h1 className="font-headline font-bold text-3xl text-on-surface mb-8">
          {t('stats.title', 'Statistiche')}
        </h1>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-surface-container-low" />)}
          </div>
        ) : (
          <>
            {/* Overview */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              <div className="bg-surface-container-low rounded-xl p-5 text-center">
                <p className="font-headline font-black text-3xl text-primary">{totalDone}</p>
                <p className="text-xs text-outline mt-1">{t('stats.completed', 'Completate')}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-5 text-center">
                <p className="font-headline font-black text-3xl text-on-surface">{totalQuestions}</p>
                <p className="text-xs text-outline mt-1">{t('stats.questions', 'Domande totali')}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-5 text-center">
                <p className={`font-headline font-black text-3xl ${globalPct >= 67 ? 'text-green-600' : 'text-error'}`}>{globalPct}%</p>
                <p className="text-xs text-outline mt-1">{t('stats.accuracy', 'Precisione')}</p>
              </div>
            </div>

            {/* Previsione esame */}
            {predictedScore !== null && (
              <div className="mb-10 bg-surface-container-low rounded-xl border border-outline-variant/20 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-headline font-bold text-lg">
                    {t('stats.prediction', 'Previsione esame')}
                  </h2>
                  <span className="text-xs text-outline">
                    {t('stats.predictionCoverage', { x: coverage, defaultValue: `basata sul ${coverage}% del peso esame` })}
                  </span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <p className={`font-headline font-black text-4xl ${predictedScore >= PASS_THRESHOLD ? 'text-green-600' : 'text-error'}`}>
                    {predictedScore}<span className="text-lg text-outline">/100</span>
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {predictedScore >= PASS_THRESHOLD
                      ? t('stats.predictionPass', 'Al ritmo attuale supereresti la soglia del 67.')
                      : t('stats.predictionFail', { x: PASS_THRESHOLD - predictedScore, defaultValue: `Ti mancano ${PASS_THRESHOLD - predictedScore} punti per la soglia del 67.` })}
                  </p>
                </div>
                {coverage < 30 && (
                  <p className="text-xs text-amber-600 mb-2">
                    {t('stats.predictionLowData', 'Pochi dati: completa più quiz per una stima affidabile.')}
                  </p>
                )}
                {topGaps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                      {t('stats.predictionGaps', 'Recupera più punti qui')}
                    </p>
                    {topGaps.map(({ area, pct, lostPoints }) => (
                      <button
                        key={area.id}
                        onClick={() => navigate(`/study/area/${area.id}`)}
                        className="w-full text-left flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-surface-container transition-colors"
                      >
                        <span className="text-on-surface truncate">
                          R{area.role_number || area.id} · {area.name}
                        </span>
                        <span className="text-xs text-error font-semibold shrink-0 ml-2">
                          {pct}% · −{lostPoints.toFixed(1)} {t('stats.points', 'punti')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Per Ruolo */}
            {areas.length > 0 && (
              <div className="mb-10">
                <h2 className="font-headline font-bold text-lg mb-4">{t('stats.perRole', 'Per Ruolo')}</h2>
                <div className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20">
                  {areas.map(area => {
                    const p = progressMap[area.id]
                    const pct = (p?.questions_completed || 0) > 0
                      ? Math.round(((p?.questions_correct || 0) / p.questions_completed) * 100)
                      : null
                    const isHighlighted = area.role_number === 4
                    return (
                      <button
                        key={area.id}
                        onClick={() => navigate(`/study/area/${area.id}`)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container transition-colors ${
                          isHighlighted ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${area.color_class || 'bg-surface-container-high text-on-surface-variant'}`}>
                          R{area.role_number || area.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-on-surface truncate">{area.name}</div>
                          <div className="text-xs text-on-surface-variant">
                            {t('stats.weightX', { x: area.weight_percent, defaultValue: `Peso: ${area.weight_percent}%` })}
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="w-24 shrink-0">
                          {pct !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-surface-container-high rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${pct >= 67 ? 'bg-green-500' : 'bg-amber-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${pct >= 67 ? 'text-green-600' : 'text-amber-600'} w-8 text-right`}>
                                {pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-outline">—</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Storico sessioni */}
            {completed.length === 0 ? (
              <div className="text-center py-16 text-outline">
                <span className="material-symbols-outlined text-[48px] block mb-3">bar_chart</span>
                <p>{t('stats.noData', 'Nessuna simulazione completata')}</p>
              </div>
            ) : (
              <div>
                <h2 className="font-headline font-bold text-lg mb-4">{t('stats.history', 'Storico sessioni')}</h2>
                <div className="space-y-3">
                  {completed.map(s => {
                    const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0
                    const passed = pct >= 67
                    return (
                      <button
                        key={s.id}
                        className="w-full text-left bg-surface-container-low rounded-xl p-4 flex items-center gap-4 hover:bg-surface-container transition-colors"
                        onClick={() => navigate(`/results/${s.id}`)}
                      >
                        <span
                          className={`material-symbols-outlined text-lg ${passed ? 'text-green-600' : 'text-error'}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {passed ? 'check_circle' : 'cancel'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-on-surface truncate">
                            {s.simulations?.title || 'Simulazione'}
                          </p>
                          <p className="text-xs text-outline">
                            {new Date(s.completed_at || s.started_at).toLocaleDateString('it-IT')} · {s.score}/{s.total} domande
                          </p>
                        </div>
                        <span className={`font-headline font-bold text-lg ${passed ? 'text-green-600' : 'text-error'}`}>
                          {pct}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </UserLayout>
  )
}
