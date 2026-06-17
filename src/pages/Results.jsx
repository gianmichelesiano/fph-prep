import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchSession, startRetrySession } from '../lib/api'
import { AREAS } from '../data/areas'
import { useAuth } from '../contexts/AuthContext'
import MarkdownView from '../components/MarkdownView'
import QuestionMultiple from '../components/QuestionMultiple'
import QuestionTrueFalse from '../components/QuestionTrueFalse'
import { supabase } from '../lib/supabase'

export default function Results() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const isPremium = profile?.is_premium || profile?.is_admin
  const [contentFlags, setContentFlags] = useState({})
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    fetchSession(sessionId)
      .then(async data => {
        setSession(data)
        setLoading(false)
        const nbIds = Array.from(
          new Set(
            (data?.questions || [])
              .map(q => q.notebook_id)
              .filter(Boolean)
          )
        )
        if (nbIds.length === 0) return
        const { data: rows } = await supabase
          .from('notebook_contents')
          .select('notebook_id, is_free')
          .in('notebook_id', nbIds)
          .eq('lang', 'it')
        const map = {}
        for (const row of rows || []) map[row.notebook_id] = { isFree: row.is_free }
        setContentFlags(map)
      })
      .catch(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-outline mb-4 block">search_off</span>
          <p className="text-secondary mb-4">Risultati non trovati</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Home</button>
        </div>
      </div>
    )
  }

  const { score, total, answers, questions } = session
  const safeScore = score ?? 0
  const safeTotal = total ?? questions?.length ?? 0
  const pct = safeTotal > 0 ? Math.round((safeScore / safeTotal) * 100) : 0
  const passed = pct >= 67

  const ringCircumference = 364.4
  const ringOffset = ringCircumference * (1 - pct / 100)

  const areaStats = {}
  ;(questions || []).forEach(q => {
    const a = q.area
    if (!areaStats[a]) areaStats[a] = { correct: 0, total: 0 }
    areaStats[a].total++
    const userAnswer = answers?.[q.id]
    let isCorrect = false
    if (q.type === 'multiple') {
      isCorrect = userAnswer === q.correct
    } else {
      const ua = userAnswer || {}
      isCorrect = (q.items || []).every((item, i) => ua[i] === item.correct)
    }
    if (isCorrect) areaStats[a].correct++
  })

  // Wrong question IDs for retry
  const wrongQuestionIds = (questions || []).filter(q => {
    const userAnswer = answers?.[q.id]
    if (userAnswer === undefined || userAnswer === null) return true // unanswered counts as wrong
    if (q.type === 'multiple') return userAnswer !== q.correct
    return !(q.items || []).every((item, j) => (userAnswer || {})[j] === item.correct)
  }).map(q => q.id)

  const wrongCount = wrongQuestionIds.length
  const allCorrect = wrongCount === 0 && (questions || []).length > 0

  async function handleRetryErrors() {
    if (!user?.id || retrying) return
    setRetrying(true)
    try {
      localStorage.setItem('fph_quiz_mode', 'practice')
      const session = await startRetrySession(user.id, wrongQuestionIds)
      navigate(`/quiz/${session.id}`)
    } catch (err) {
      console.error(err)
      setRetrying(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="bg-surface-container-lowest/90 backdrop-blur-md fixed top-0 w-full z-50 shadow-editorial">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="text-xl font-headline font-bold text-primary tracking-tight italic">FPH Prep</div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-headline font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            Home
          </button>
        </div>
      </header>

      <main className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-12">
          <div className="relative w-44 h-44 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-container-high" />
              <circle
                cx="64" cy="64" r="58" fill="none" strokeWidth="8"
                stroke={passed ? '#16a34a' : '#dc2626'}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline font-black text-4xl text-on-surface">{pct}%</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${passed ? 'text-green-600' : 'text-error'}`}>
                {passed ? 'Superato' : 'Non superato'}
              </span>
            </div>
          </div>
          <p className="text-on-surface-variant text-sm">
            {safeScore} risposte corrette su {safeTotal} domande
          </p>
          <p className="text-xs text-outline mt-1">{session.simulations?.title}</p>
        </div>

        {Object.keys(areaStats).length > 0 && (
          <div className="mb-10">
            <h3 className="font-headline font-bold text-lg mb-4">Risultati per ruolo</h3>
            <div className="space-y-3">
              {Object.entries(areaStats).map(([areaId, stat]) => {
                const area = AREAS[Number(areaId)]
                const areaPct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
                return (
                  <div key={areaId} className="bg-surface-container-low rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${area?.color || 'bg-surface-container-high text-outline'}`}>
                          R{areaId}
                        </span>
                        <span className="text-sm font-medium text-on-surface">{area?.name || `Area ${areaId}`}</span>
                      </div>
                      <span className="text-sm font-bold text-on-surface">{stat.correct}/{stat.total}</span>
                    </div>
                    <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${areaPct >= 67 ? 'bg-green-500' : 'bg-error'}`}
                        style={{ width: `${areaPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(questions || []).length > 0 && (
          <div>
            <h3 className="font-headline font-bold text-lg mb-4">{t('results.reviewTitle', 'Revisione domande')}</h3>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const userAnswer = answers?.[q.id]
                const isUnanswered = userAnswer === undefined || userAnswer === null
                let isCorrect = false
                if (!isUnanswered) {
                  if (q.type === 'multiple') isCorrect = userAnswer === q.correct
                  else isCorrect = (q.items || []).every((item, j) => (userAnswer || {})[j] === item.correct)
                }

                return (
                  <details
                    key={q.id}
                    open={!isCorrect || isUnanswered}
                    className={`rounded-xl border-2 group ${
                      isUnanswered ? 'border-outline-variant/40 bg-surface-container-lowest' :
                      isCorrect ? 'border-green-200 bg-green-50/20' : 'border-error/20 bg-error-container/10'
                    }`}
                  >
                    <summary className="p-4 cursor-pointer flex items-start gap-3 hover:bg-surface-container-low/50 transition-colors rounded-xl">
                      <span className={`material-symbols-outlined text-lg mt-0.5 shrink-0 ${
                        isUnanswered ? 'text-outline' : isCorrect ? 'text-green-600' : 'text-error'
                      }`}
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isUnanswered ? 'help' : isCorrect ? 'check_circle' : 'cancel'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-outline">{t('results.question', 'Domanda')} {i + 1}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            q.type === 'multiple' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'
                          }`}>
                            {q.type === 'multiple' ? 'MC-A' : 'K-Prim'}
                          </span>
                          <span className="text-xs text-outline">— {AREAS[q.area]?.name || 'Area ' + q.area}</span>
                          {isUnanswered && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-outline-variant text-outline font-medium">
                              {t('results.unanswered', 'Non risposta')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-on-surface leading-snug">{q.text}</p>
                      </div>
                      <span className="material-symbols-outlined text-outline text-sm shrink-0 mt-0.5 transition-transform group-open:rotate-180">
                        expand_more
                      </span>
                    </summary>

                    <div className="px-4 pb-4 pt-0">
                      {/* User answer display */}
                      {!isUnanswered && (
                        <div className="mb-4 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
                          <p className="text-[10px] text-outline font-semibold uppercase tracking-wider mb-2">
                            {t('results.yourAnswer', 'Tua risposta')}
                          </p>
                          <div className="scale-[0.95] origin-top-left">
                            {q.type === 'multiple' ? (
                              <QuestionMultiple question={q} answer={userAnswer} showResult={true} />
                            ) : (
                              <QuestionTrueFalse question={q} answer={userAnswer} showResult={true} />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {q.motivation && (
                        <div className="p-4 bg-surface-container rounded-lg max-h-64 overflow-y-auto mb-3">
                          <p className="text-xs text-outline font-semibold mb-1">{t('results.motivation', 'Spiegazione')}</p>
                          <MarkdownView content={q.motivation} className="prose-sm" />
                        </div>
                      )}

                      {/* Notebook link */}
                      {q.notebook && contentFlags[q.notebook_id] && (() => {
                        const locked = !contentFlags[q.notebook_id].isFree && !isPremium
                        return (
                          <button
                            onClick={() => locked ? navigate('/upgrade') : navigate(`/study/topic/${q.notebook.key}`)}
                            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {locked ? 'lock' : 'menu_book'}
                            </span>
                            {t('study.reviewTopic', 'Ripassa questo argomento')} — {q.notebook.title}{locked ? ' (Premium)' : ''}
                          </button>
                        )
                      })()}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-10 justify-center flex-wrap">
          <button onClick={() => navigate('/')} className="btn-secondary">
            {t('results.home', 'Torna alla home')}
          </button>
          {allCorrect ? (
            <div className="w-full text-center mt-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-semibold">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                {t('results.allCorrect', 'Tutte le risposte corrette! Ottimo lavoro!')}
              </div>
            </div>
          ) : wrongCount > 0 ? (
            <button
              onClick={handleRetryErrors}
              disabled={retrying}
              className="btn-primary flex items-center gap-2"
            >
              {retrying ? (
                <span className="animate-spin w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full" />
              ) : (
                <span className="material-symbols-outlined text-sm">replay</span>
              )}
              {t('results.retryErrors', { count: wrongCount, defaultValue: `Riprova gli errori (${wrongCount})` })}
            </button>
          ) : null}
        </div>
      </main>
    </div>
  )
}
