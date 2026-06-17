import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UserLayout from '../components/UserLayout'
import { fetchAreasWithProgress, fetchAllAreaProgress } from '../lib/areasApi'
import { getAreaQuestionCounts } from '../lib/adminApi'
import { fetchAreaCounts } from '../lib/notebookContentsApi'

export default function Study() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [areas, setAreas] = useState([])
  const [progress, setProgress] = useState([])
  const [questionCounts, setQuestionCounts] = useState({})
  const [areaContentCounts, setAreaContentCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchArea, setSearchArea] = useState('')

  useEffect(() => {
    Promise.all([
      fetchAreasWithProgress(),
      fetchAllAreaProgress().catch(() => []),
      getAreaQuestionCounts().catch(() => ({})),
      fetchAreaCounts(i18n.language || 'it').catch(() => ({})),
    ])
      .then(([a, p, c, ct]) => {
        setAreas(a)
        setProgress(p)
        setQuestionCounts(c)
        setAreaContentCounts(ct)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [i18n.language])

  const progressMap = {}
  progress.forEach(p => { progressMap[p.area_id] = p })

  function normalize(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  const filteredAreas = useMemo(() => {
    if (!searchArea.trim()) return areas
    const normQuery = normalize(searchArea)
    return areas.filter(a => {
      const normName = normalize(a.name)
      const roleText = normalize(`ruolo ${a.role_number || a.id}`)
      return normName.includes(normQuery) || roleText.includes(normQuery)
    })
  }, [areas, searchArea])

  const totalQuestions = areas.reduce((sum, a) => sum + (questionCounts[a.id] || 0), 0)
  const completedQuestions = progress.reduce((sum, p) => sum + (p.questions_completed || 0), 0)
  const totalCorrect = progress.reduce((sum, p) => sum + (p.questions_correct || 0), 0)
  const totalContentAreas = Object.values(areaContentCounts).filter(c => c.withContent > 0).length

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-8">
          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] uppercase tracking-[0.2em] font-bold rounded-full mb-3">
            {t('nav.study')}
          </span>
          <h1 className="font-headline font-bold text-3xl text-on-surface">
            {t('study.title', 'Preparazione per Ruolo')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('study.subtitle', 'Scegli un ruolo per studiare teoria, fare quiz e monitorare i progressi')}
          </p>
        </header>

        {/* Overview card */}
        {!loading && areas.length > 0 && (
          <div className="card mb-6 p-5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{totalQuestions}</div>
                <div className="text-xs text-on-surface-variant mt-1">{t('study.totalQuestions', 'Domande totali')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{completedQuestions}</div>
                <div className="text-xs text-on-surface-variant mt-1">{t('study.completed', 'Completate')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {completedQuestions > 0 ? Math.round((totalCorrect / completedQuestions) * 100) : 0}%
                </div>
                <div className="text-xs text-on-surface-variant mt-1">{t('study.accuracy', 'Accuratezza')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{totalContentAreas}/{areas.length}</div>
                <div className="text-xs text-on-surface-variant mt-1">{t('study.contentCoverage', 'Aree con teoria')}</div>
              </div>
            </div>
            {/* Global progress bar */}
            <div className="w-full bg-surface-container-high rounded-full h-2 mt-4">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Area search */}
        {!loading && areas.length > 0 && (
          <div className="relative mb-6 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">search</span>
            <input
              type="text"
              className="input text-sm w-full pl-10"
              placeholder={t('study.searchAreas', 'Cerca ruoli...')}
              value={searchArea}
              onChange={e => setSearchArea(e.target.value)}
            />
          </div>
        )}

        {loading ? (
          <div className="text-on-surface-variant">{t('common.loading', 'Caricamento...')}</div>
        ) : filteredAreas.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] block mb-3 text-outline">search_off</span>
            <p className="text-sm text-on-surface-variant mb-4">
              {t('study.noAreasFound', { query: searchArea, defaultValue: `Nessun ruolo trovato per '${searchArea}'` })}
            </p>
            <button
              onClick={() => setSearchArea('')}
              className="btn-secondary text-sm"
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
              {t('study.clearFilters', 'Pulisci filtri')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAreas.map(area => {
              const p = progressMap[area.id]
              const qCount = questionCounts[area.id] || 0
              const pct = qCount > 0 ? Math.round(((p?.questions_completed || 0) / qCount) * 100) : 0
              const scorePct = (p?.questions_completed || 0) > 0
                ? Math.round(((p?.questions_correct || 0) / p.questions_completed) * 100)
                : null
              const isHighlighted = area.role_number === 4
              const contentInfo = areaContentCounts[area.id]
              const hasContent = contentInfo && contentInfo.withContent > 0

              return (
                <button
                  key={area.id}
                  onClick={() => navigate(`/study/area/${area.id}`)}
                  className={`text-left p-5 rounded-xl border transition-all hover:shadow-md group ${
                    isHighlighted
                      ? 'border-primary/30 bg-primary/5 ring-2 ring-primary/20'
                      : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color_class || 'bg-surface-container-high text-on-surface-variant'}`}>
                        {t('study.role', { n: area.role_number || area.id, defaultValue: `Ruolo ${area.role_number || area.id}` })}
                      </div>
                      <h3 className="font-semibold text-on-surface mt-2 text-sm leading-snug">{area.name}</h3>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-bold text-on-surface">{area.weight_percent ?? '–'}%</div>
                      <div className="text-[10px] text-outline uppercase">{t('study.weight', 'Peso')}</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mb-3">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">quiz</span>
                      {qCount} {t('study.questions', 'domande')}
                    </span>
                    {scorePct !== null && (
                      <span className={`flex items-center gap-1 font-semibold ${scorePct >= 67 ? 'text-green-600' : 'text-amber-600'}`}>
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        {scorePct}%
                      </span>
                    )}
                    {hasContent && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <span className="material-symbols-outlined text-[14px]">menu_book</span>
                        {contentInfo.withContent}/{contentInfo.total}
                      </span>
                    )}
                    {!hasContent && (
                      <span className="flex items-center gap-1 text-outline">
                        <span className="material-symbols-outlined text-[14px]">menu_book</span>
                        —
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-surface-container-high rounded-full h-1.5 mb-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct >= 67 ? 'bg-green-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-outline">
                      {p?.questions_completed || 0}/{qCount} {t('study.completedShort', 'completate')}
                    </div>
                    {/* CTA arrow always visible */}
                    <span className="text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </span>
                  </div>

                  {isHighlighted && (
                    <div className="mt-3 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full inline-block">
                      50% {t('study.ofExam', "dell'esame")}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </UserLayout>
  )
}
