import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../hooks/useSession'
import { fetchSession } from '../lib/api'
import { AREAS } from '../data/areas'
import QuestionMultiple from '../components/QuestionMultiple'
import QuestionTrueFalse from '../components/QuestionTrueFalse'
import Timer from '../components/Timer'

const AREA_TAG_COLORS = {
  1:'bg-amber-100 text-amber-800', 2:'bg-green-100 text-green-800', 3:'bg-teal-100 text-teal-800',
  4:'bg-blue-100 text-blue-800', 5:'bg-indigo-100 text-indigo-800', 6:'bg-orange-100 text-orange-800',
  7:'bg-yellow-100 text-yellow-700', 8:'bg-red-100 text-red-800', 9:'bg-pink-100 text-pink-800',
  10:'bg-gray-100 text-gray-700',
}

export default function Quiz() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { answers, currentIndex, syncStatus, answerQuestion, goToIndex, finish, saveNow, restoreState } = useSession(sessionId)

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    fetchSession(sessionId)
      .then(data => {
        setSession(data)
        setLoading(false)
        setRestored(true)
      })
      .catch(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    if (!restored || !session) return
    restoreState(session.answers || {}, session.current_index || 0)
  }, [restored])

  const questions = session?.questions || []
  const q = questions[currentIndex]
  const totalQ = questions.length
  const answered = Object.keys(answers).length
  const progressPct = totalQ > 0 ? ((currentIndex + 1) / totalQ) * 100 : 0
  const canAnswer = !submitting && !timerExpired
  const timer = session?.simulations?.timer

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      await finish(questions)
      navigate(`/results/${sessionId}`)
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  async function handleTimerExpire() {
    setTimerExpired(true)
    try {
      await finish(questions)
      setTimeout(() => navigate(`/results/${sessionId}`), 2000)
    } catch {}
  }

  function handleAnswer(val) {
    if (!canAnswer || !q) return
    answerQuestion(q.id, val)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!session || !q) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">Sessione non trovata</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Home</button>
        </div>
      </div>
    )
  }

  const areaTag = AREA_TAG_COLORS[q.area] || 'bg-gray-100 text-gray-700'
  const areaName = AREAS[q.area]?.name || `Area ${q.area}`
  const answer = answers[q.id]

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-primary/10 shadow-editorial flex justify-between items-center px-8 lg:px-12 h-20">
        <div className="flex items-center gap-6">
          <span className="font-headline font-black text-primary uppercase tracking-widest text-xs">Exam Mode</span>
          <div className="hidden sm:block h-6 w-px bg-outline-variant/30" />
          <div className="hidden sm:flex flex-col">
            <span className="font-headline font-bold text-primary text-sm">
              Domanda {currentIndex + 1} di {totalQ}
            </span>
            <div className="w-40 h-1.5 bg-surface-container-highest rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => { await saveNow(); navigate('/') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 text-xs font-headline font-bold text-on-surface-variant hover:bg-surface-container-low transition-all"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            Home
          </button>
          {timer && !submitting && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-primary text-sm">schedule</span>
              <Timer minutes={timer} onExpire={handleTimerExpire} />
            </div>
          )}
          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-on-surface-variant/60">
              <span className="material-symbols-outlined text-xs">sync</span> Salvataggio...
            </span>
          )}
          {timerExpired ? (
            <span className="text-sm font-semibold text-error">Tempo scaduto!</span>
          ) : currentIndex === totalQ - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || timerExpired}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? 'Consegna...' : `Consegna (${answered}/${totalQ})`}
            </button>
          ) : null}
        </div>
      </header>

      <main className="pt-28 pb-12 px-6 lg:px-12 min-h-screen flex gap-8 lg:gap-12">
        <div className="flex-grow max-w-4xl">
          <div className="mb-8">
            <span className={`area-tag ${areaTag} mb-4 inline-block`}>{areaName}</span>
            {q.topic && <span className="ml-2 text-xs text-on-surface-variant">{q.topic}</span>}
            <h1 className="font-headline font-extrabold text-2xl lg:text-3xl text-on-surface leading-tight tracking-tight mt-3">
              {q.text}
            </h1>
          </div>

          <div className="bg-surface-container-low p-6 lg:p-8 rounded-[2rem]">
            {q.type === 'multiple' && (
              <QuestionMultiple question={q} answer={answer} onChange={handleAnswer} showResult={false} />
            )}
            {q.type === 'truefalse' && (
              <QuestionTrueFalse question={q} answer={answer} onChange={handleAnswer} showResult={false} />
            )}
          </div>

          <div className="flex justify-between items-center pt-8">
            <button
              disabled={currentIndex === 0}
              onClick={() => goToIndex(currentIndex - 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-outline-variant/30 font-headline font-bold text-primary hover:bg-surface-container-low transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Precedente
            </button>
            {currentIndex < totalQ - 1 ? (
              <button
                onClick={async () => { await saveNow(); goToIndex(currentIndex + 1) }}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold shadow-editorial hover:opacity-90 active:scale-95 transition-all"
              >
                Successiva
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || timerExpired}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold shadow-editorial hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {submitting ? 'Consegna...' : 'Consegna esame'}
                <span className="material-symbols-outlined">send</span>
              </button>
            )}
          </div>
        </div>

        <aside className="hidden lg:block w-48 shrink-0">
          <p className="text-xs text-outline font-semibold uppercase tracking-wider mb-3">Navigazione</p>
          <div className="grid grid-cols-5 gap-1">
            {questions.map((question, i) => (
              <button
                key={question.id}
                onClick={() => goToIndex(i)}
                className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                  i === currentIndex
                    ? 'bg-primary text-on-primary'
                    : answers[question.id] !== undefined
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container-high text-outline hover:bg-surface-container-highest'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="text-xs text-outline mt-3">{answered} / {totalQ} risposte</p>
        </aside>
      </main>
    </div>
  )
}
