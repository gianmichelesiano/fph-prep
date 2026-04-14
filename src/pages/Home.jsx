import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { fetchSimulations, startSession, fetchUserSessions } from '../lib/api'
import { canAccessSimulation } from '../utils/access'
import UserLayout from '../components/UserLayout'
import { AREAS } from '../data/areas'

export default function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [simulations, setSimulations] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)

  useEffect(() => {
    fetchSimulations().then(sims => {
      setSimulations(sims)
      setLoading(false)
    }).catch(() => setLoading(false))

    if (user) {
      fetchUserSessions(user.id).then(setSessions).catch(() => {})
    }
  }, [user])

  async function handleStart(sim) {
    if (!canAccessSimulation(sim, profile?.is_premium)) {
      navigate('/upgrade')
      return
    }
    setStarting(sim.id)
    try {
      const session = await startSession(sim.id, user.id)
      navigate(`/quiz/${session.id}`)
    } catch (err) {
      console.error(err)
      setStarting(null)
    }
  }

  function handleResume(sessionId) {
    navigate(`/quiz/${sessionId}`)
  }

  function handleReview(sessionId) {
    navigate(`/results/${sessionId}`)
  }

  const lastSessionBySim = {}
  sessions.forEach(s => {
    if (!lastSessionBySim[s.simulation_id] || s.started_at > lastSessionBySim[s.simulation_id].started_at) {
      lastSessionBySim[s.simulation_id] = s
    }
  })

  const exam = simulations.filter(s => s.type === 'exam')
  const custom = simulations.filter(s => s.type === 'custom')

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="font-headline font-black text-3xl text-on-surface mb-1">
            {t('dashboard.title', 'Simulazioni disponibili')}
          </h1>
          <p className="text-secondary text-sm">
            {t('dashboard.subtitle', 'Scegli una simulazione per iniziare')}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl p-6 bg-surface-container-low animate-pulse h-48" />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {exam.length > 0 && (
              <section>
                <h2 className="font-headline font-bold text-lg text-on-surface mb-4">Simulazioni d'Esame</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {exam.map(sim => (
                    <SimCard
                      key={sim.id}
                      sim={sim}
                      lastSession={lastSessionBySim[sim.id]}
                      isPremium={profile?.is_premium}
                      isStarting={starting === sim.id}
                      onStart={() => handleStart(sim)}
                      onResume={handleResume}
                      onReview={handleReview}
                    />
                  ))}
                </div>
              </section>
            )}
            {custom.length > 0 && (
              <section>
                <h2 className="font-headline font-bold text-lg text-on-surface mb-4">Simulazioni Custom</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {custom.map(sim => (
                    <SimCard
                      key={sim.id}
                      sim={sim}
                      lastSession={lastSessionBySim[sim.id]}
                      isPremium={profile?.is_premium}
                      isStarting={starting === sim.id}
                      onStart={() => handleStart(sim)}
                      onResume={handleResume}
                      onReview={handleReview}
                    />
                  ))}
                </div>
              </section>
            )}
            {simulations.length === 0 && (
              <div className="text-center py-20 text-outline">
                <span className="material-symbols-outlined text-[48px] block mb-3">quiz</span>
                <p>Nessuna simulazione disponibile</p>
              </div>
            )}
          </div>
        )}
      </div>
    </UserLayout>
  )
}

function SimCard({ sim, lastSession, isPremium, isStarting, onStart, onResume, onReview }) {
  const hasAccess = canAccessSimulation(sim, isPremium)
  const isCompleted = lastSession?.status === 'completed'
  const isInProgress = lastSession?.status === 'in_progress'

  const totalQ = Object.values(sim.area_config || {}).reduce((s, n) => s + Number(n), 0)
  const pct = isCompleted && lastSession.total > 0
    ? Math.round((lastSession.score / lastSession.total) * 100)
    : null
  const passed = pct !== null && pct >= 67

  return (
    <div className={`rounded-xl p-6 border transition-all duration-200 flex flex-col ${
      isCompleted ? 'bg-surface-container-low border-outline-variant/20' :
      isInProgress ? 'bg-surface-container-lowest border-primary/20 shadow-sm' :
      'bg-surface-container-lowest border-outline-variant/20 hover:shadow-md'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
          sim.type === 'exam' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'
        }`}>
          {sim.type === 'exam' ? 'Esame' : 'Custom'}
        </span>
        {isCompleted && (
          <span className={`material-symbols-outlined ${passed ? 'text-green-600' : 'text-error'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}>
            {passed ? 'check_circle' : 'cancel'}
          </span>
        )}
        {isInProgress && <div className="h-2 w-2 rounded-full bg-primary animate-pulse mt-1" />}
        {!hasAccess && <span className="material-symbols-outlined text-outline">lock</span>}
      </div>

      <h4 className="font-headline font-bold text-base mb-2 text-on-surface flex-1">{sim.title}</h4>

      <div className="flex items-center gap-3 text-on-surface-variant text-xs mb-4">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">quiz</span>
          {totalQ} domande
        </span>
        {sim.timer && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {sim.timer} min
          </span>
        )}
      </div>

      {isCompleted ? (
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${passed ? 'text-green-600' : 'text-error'}`}>
            {pct}% {passed ? '✓' : '✗'}
          </span>
          <div className="flex gap-1 ml-auto">
            <button onClick={() => onReview(lastSession.id)} className="text-xs text-primary hover:underline">Rivedi</button>
            <span className="text-outline">·</span>
            <button onClick={onStart} className="text-xs text-primary hover:underline" disabled={isStarting}>
              {isStarting ? '...' : 'Riprova'}
            </button>
          </div>
        </div>
      ) : isInProgress ? (
        <button
          onClick={() => onResume(lastSession.id)}
          className="w-full py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold"
        >
          Continua
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={isStarting || !hasAccess}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            !hasAccess
              ? 'bg-surface-container-high text-outline cursor-not-allowed'
              : 'bg-primary text-on-primary hover:opacity-90'
          }`}
        >
          {isStarting ? 'Caricamento...' : !hasAccess ? 'Premium' : 'Avvia'}
        </button>
      )}
    </div>
  )
}
