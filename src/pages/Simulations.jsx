import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { fetchSimulations, startSession, fetchUserSessions } from '../lib/api'
import { canAccessSimulation } from '../utils/access'
import UserLayout from '../components/UserLayout'

// ===== SIM CARD =====
function SimCard({ sim, result, isPremium, onClick, onResume, onUpgrade, onReview }) {
  const { t } = useTranslation()
  const hasAccess = canAccessSimulation(sim, isPremium)
  const isCompleted = result?.status === 'completed'
  const isInProgress = result?.status === 'in_progress'
  const isLocked = !hasAccess
  const isNotStarted = !isCompleted && !isInProgress && !isLocked

  const totalQ = Object.values(sim.area_config || {}).reduce((s, n) => s + Number(n), 0)
  const pct = isCompleted && result.total > 0 ? Math.round((result.score / result.total) * 100) : null
  const passed = pct !== null && pct >= 67

  let cardClass = 'group rounded-xl p-6 transition-all duration-300 cursor-pointer '
  if (isCompleted)    cardClass += 'bg-surface-container-low hover:-translate-y-1'
  else if (isInProgress) cardClass += 'bg-surface-container-lowest border-2 border-primary/10 hover:shadow-lg'
  else if (isLocked)  cardClass += 'bg-surface-container-low'
  else                cardClass += 'bg-surface-container-lowest hover:shadow-md'

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${sim.type === 'exam' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
          {sim.type === 'exam' ? 'Esame' : 'Custom'}
        </span>
        {isCompleted && (
          <span
            className={`material-symbols-outlined ${passed ? 'text-green-600' : 'text-error'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {passed ? 'check_circle' : 'cancel'}
          </span>
        )}
        {isInProgress && (
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse mt-1" />
        )}
        {isLocked && (
          <span className="material-symbols-outlined text-outline">lock</span>
        )}
        {isNotStarted && (
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider">{t('dashboard.notStarted')}</span>
        )}
      </div>

      <h4 className="font-headline font-bold text-lg mb-2 text-on-surface">{sim.title}</h4>

      <div className="flex items-center gap-3 text-on-surface-variant text-xs mb-6">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">quiz</span>
          {totalQ || '—'} {t('dashboard.questions')}
        </span>
        {sim.timer && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {sim.timer} min
          </span>
        )}
      </div>

      <div className="flex justify-between items-center">
        {isCompleted && (
          <>
            <span className={`text-[10px] font-bold uppercase ${passed ? 'text-green-600' : 'text-error'}`}>
              {passed ? `${t('dashboard.passedLabel')} (${pct}%)` : `${t('dashboard.failedLabel')} (${pct}%)`}
            </span>
            <button
              className="text-primary text-xs font-bold hover:underline"
              onClick={e => { e.stopPropagation(); onReview() }}
            >
              {t('dashboard.reviewResult')}
            </button>
          </>
        )}
        {isInProgress && (
          <>
            <span className="text-[10px] font-bold text-primary uppercase">
              {t('dashboard.inProgress')} ({result.currentIndex || 0}/{result.total || '?'})
            </span>
            <button
              className="px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full text-xs font-bold"
              onClick={e => { e.stopPropagation(); onResume() }}
            >
              {t('dashboard.resume')}
            </button>
          </>
        )}
        {isLocked && (
          <>
            <span className="text-[10px] font-bold text-outline uppercase">{t('dashboard.premiumContent')}</span>
            <button
              className="text-primary text-xs font-bold flex items-center gap-1"
              onClick={e => { e.stopPropagation(); onUpgrade() }}
            >
              {t('dashboard.upgradeBtn')} <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </>
        )}
        {isNotStarted && (
          <>
            <span className="text-[10px] font-bold text-outline uppercase">{t('dashboard.unattempted')}</span>
            <button
              className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold hover:bg-surface-container-highest transition-colors"
              onClick={e => { e.stopPropagation(); onClick() }}
            >
              {t('dashboard.startExam')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Simulations() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [simulations, setSimulations] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showModeDialog, setShowModeDialog] = useState(null)
  const [selectedMode, setSelectedMode] = useState(() => {
    try { return localStorage.getItem('fph_quiz_mode') || 'exam' } catch { return 'exam' }
  })

  const isPremium = profile?.is_premium

  useEffect(() => {
    if (!user) return
    fetchSimulations()
      .then(data => { setSimulations(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
    fetchUserSessions(user.id).then(setSessions).catch(() => {})
  }, [user])

  const progress = {}
  sessions.forEach(s => {
    const existing = progress[s.simulation_id]
    if (!existing || s.started_at > existing.started_at) {
      progress[s.simulation_id] = { sessionId: s.id, status: s.status, score: s.score, total: s.total, currentIndex: s.current_index }
    }
  })

  function handleStart(sim) {
    if (!canAccessSimulation(sim, isPremium)) { navigate('/upgrade'); return }
    setShowModeDialog(sim)
  }

  async function handleConfirmStart(mode) {
    const sim = showModeDialog
    if (!sim) return
    setShowModeDialog(null)
    localStorage.setItem('fph_quiz_mode', mode)
    setSelectedMode(mode)
    setStarting(sim.id)
    try {
      const session = await startSession(sim.id, user.id)
      navigate(`/quiz/${session.id}`)
    } catch (err) {
      console.error(err)
      setStarting(null)
    }
  }

  const sorted = [...simulations].sort((a, b) => a.title.localeCompare(b.title))
  const filtered = sorted.filter(s => {
    const result = progress[s.id]
    if (filter === 'pending') return !result || result.status !== 'completed'
    if (filter === 'completed') return result?.status === 'completed'
    return true
  })

  return (
    <UserLayout>
      <div className="p-6 md:p-8 min-h-screen">
        {/* Header */}
        <header className="mb-8">
          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] uppercase tracking-[0.2em] font-bold rounded-full mb-3">
            {t('nav.examSimulation')}
          </span>
          <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-primary tracking-tight mb-2">
            {t('dashboard.simulationModules')}
          </h2>
          <p className="text-on-surface-variant font-medium text-sm md:text-base">
            {t('dashboard.subtitle')}
          </p>
        </header>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h3 className="font-headline font-bold text-xl text-on-surface">
            {filtered.length} {t('dashboard.simulationsCount', 'simulazioni')}
          </h3>
          <div className="flex gap-2">
            {[
              { key: 'all',       label: t('dashboard.allAreas') },
              { key: 'pending',   label: t('dashboard.filterPending') },
              { key: 'completed', label: t('dashboard.filterCompleted') },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${
                  filter === key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sim Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-surface-container-low rounded w-1/3 mb-4" />
                <div className="h-5 bg-surface-container-low rounded w-2/3 mb-2" />
                <div className="h-3 bg-surface-container-low rounded w-1/2 mb-6" />
                <div className="h-8 bg-surface-container-low rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface-container-lowest rounded-xl p-8 text-center text-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3 block">inbox</span>
            <p className="text-on-surface-variant">Nessuna simulazione trovata</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(sim => {
              const result = progress[sim.id]
              return (
                <SimCard
                  key={sim.id}
                  sim={sim}
                  result={result}
                  isPremium={isPremium}
                  onClick={() => handleStart(sim)}
                  onResume={() => navigate(`/quiz/${result?.sessionId}`)}
                  onUpgrade={() => navigate('/upgrade')}
                  onReview={() => navigate(`/results/${result?.sessionId}`)}
                />
              )
            })}
          </div>
        )}

        {/* Mode Selection Dialog */}
        {showModeDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowModeDialog(null)} />
            <div className="relative bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 z-10">
              <h3 className="font-headline font-bold text-xl text-on-surface mb-2">
                {t('quiz.selectMode', 'Scegli modalità')}
              </h3>
              <p className="text-sm text-on-surface-variant mb-6">
                {showModeDialog.title}
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleConfirmStart('exam')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedMode === 'exam'
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/30 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="material-symbols-outlined text-primary text-xl">assignment</span>
                    <span className="font-headline font-bold text-on-surface">{t('quiz.examMode', 'Modalità Esame')}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant ml-9">
                    {t('quiz.modeExamDesc', 'Feedback solo alla fine, timer attivo')}
                  </p>
                </button>

                <button
                  onClick={() => handleConfirmStart('practice')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedMode === 'practice'
                      ? 'border-tertiary bg-tertiary/5'
                      : 'border-outline-variant/30 hover:border-tertiary/40'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="material-symbols-outlined text-tertiary text-xl">lightbulb</span>
                    <span className="font-headline font-bold text-on-surface">{t('quiz.practiceMode', 'Modalità Pratica')}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant ml-9">
                    {t('quiz.modePracticeDesc', 'Feedback immediato, nessun timer')}
                  </p>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModeDialog(null)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant font-bold text-sm hover:bg-surface-container-low transition-colors"
                >
                  {t('common.cancel', 'Annulla')}
                </button>
                <button
                  onClick={() => handleConfirmStart(selectedMode)}
                  disabled={!!starting}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {starting ? t('common.loading', '...') : t('quiz.startMode', 'Inizia')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  )
}
