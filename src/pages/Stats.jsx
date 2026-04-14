import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { fetchUserSessions } from '../lib/api'
import { AREAS } from '../data/areas'
import UserLayout from '../components/UserLayout'

export default function Stats() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchUserSessions(user.id)
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  const completed = sessions.filter(s => s.status === 'completed')
  const totalDone = completed.length
  const totalQuestions = completed.reduce((sum, s) => sum + (s.total || 0), 0)
  const totalCorrect = completed.reduce((sum, s) => sum + (s.score || 0), 0)
  const globalPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

  return (
    <UserLayout>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-headline font-black text-3xl text-on-surface mb-8">
          {t('stats.title', 'Le tue statistiche')}
        </h1>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-surface-container-low" />)}
          </div>
        ) : (
          <>
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
                      <div
                        key={s.id}
                        className="bg-surface-container-low rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-container transition-colors"
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
                      </div>
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
