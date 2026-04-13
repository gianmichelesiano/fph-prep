import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProgress } from '../hooks/useProgress'
import { fetchSimulation } from '../lib/api'
import { canAccessSimulation } from '../utils/access'
import { AREAS } from '../data/areas'
import QuestionMultiple from '../components/QuestionMultiple'
import QuestionTrueFalse from '../components/QuestionTrueFalse'
import Timer from '../components/Timer'

const AREA_TAG_COLORS = {
  1:'bg-amber-100 text-amber-800', 2:'bg-green-100 text-green-800', 3:'bg-teal-100 text-teal-800',
  4:'bg-blue-100 text-blue-800', 5:'bg-indigo-100 text-indigo-800', 6:'bg-orange-100 text-orange-800',
  7:'bg-yellow-100 text-yellow-700', 8:'bg-red-100 text-red-800', 9:'bg-pink-100 text-pink-800',
}

function isAnswerComplete(question, answer) {
  if (answer === undefined || answer === null) return false
  if (question.type === 'multiple') return answer !== undefined
  if (question.type === 'truefalse') return question.items.every((_, i) => (answer || {})[i] !== undefined)
  return false
}

export default function Quiz() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { progress, saveResult, savePartial, syncStatus } = useProgress()

  const [test, setTest] = useState(null)
  const [loadingTest, setLoadingTest] = useState(true)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)

  useEffect(() => {
    fetchSimulation(id)
      .then(data => {
        if (!canAccessSimulation(data, profile?.is_premium)) { navigate('/upgrade'); return }
        const saved = progress[id]
        if (saved?.status === 'in_progress') {
          setCurrent(saved.currentIndex || 0)
          setAnswers(saved.answers || {})
        }
        setTest(data)
        setLoadingTest(false)
      })
      .catch(() => setLoadingTest(false))
  }, [id])

  useEffect(() => {
    if (test && !submitted) savePartial(id, answers, current)
  }, [answers, current])

  if (loadingTest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">Simulazione non trovata</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Home</button>
        </div>
      </div>
    )
  }

  const q = test.questions[current]
  const answer = answers[current]
  const canAnswer = !submitted && !timerExpired
  const totalQ = test.questions.length
  const answered = Object.keys(answers).length
  const progressPct = ((current + 1) / totalQ) * 100
  const areaTag = AREA_TAG_COLORS[test.area] || 'bg-gray-100 text-gray-700'
  const areaName = AREAS[test.area]?.name || `Area ${test.area}`

  function handleAnswer(val) { if (canAnswer) setAnswers(prev => ({ ...prev, [current]: val })) }

  function calcScore(questions, answers) {
    let score = 0
    questions.forEach((q, i) => {
      const ans = answers[i]
      if (q.type === 'multiple') { if (ans === q.correct) score++ }
      else if (q.type === 'truefalse') {
        const correct = q.items.filter((item, j) => (ans || {})[j] === item.correct).length
        if (correct === q.items.length) score += 1
        else if (correct === q.items.length - 1) score += 0.5
      }
    })
    return score
  }

  function handleSubmit() {
    const score = calcScore(test.questions, answers)
    saveResult(id, { status: 'completed', score, total: totalQ, answers })
    navigate(`/results/${id}`)
  }

  function handleTimerExpire() {
    setTimerExpired(true)
    const score = calcScore(test.questions, answers)
    saveResult(id, { status: 'completed', score, total: totalQ, answers })
    setTimeout(() => navigate(`/results/${id}`), 2000)
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      {/* Fixed top header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-primary/10 shadow-editorial flex justify-between items-center px-8 lg:px-12 h-20">
        <div className="flex items-center gap-6">
          <span className="font-headline font-black text-primary uppercase tracking-widest text-xs">Exam Mode</span>
          <div className="hidden sm:block h-6 w-px bg-outline-variant/30" />
          <div className="hidden sm:flex flex-col">
            <span className="font-headline font-bold text-primary text-sm">
              Domanda {current + 1} di {totalQ}
            </span>
            <div className="w-40 h-1.5 bg-surface-container-highest rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {test.timer && !submitted && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-primary text-sm">schedule</span>
              <Timer minutes={test.timer} onExpire={handleTimerExpire} />
            </div>
          )}
          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-on-surface-variant/60">
              <span className="material-symbols-outlined text-xs">sync</span> Salvataggio...
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-on-surface-variant/60">
              <span className="material-symbols-outlined text-xs" style={{fontVariationSettings:"'FILL' 1"}}>cloud_done</span> Salvato
            </span>
          )}
          {timerExpired ? (
            <span className="text-sm font-semibold text-error">Tempo scaduto!</span>
          ) : current === totalQ - 1 ? (
            <button onClick={handleSubmit} disabled={timerExpired}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all">
              Consegna ({answered}/{totalQ})
            </button>
          ) : null}
        </div>
      </header>

      {/* Main content */}
      <main className="pt-28 pb-12 px-6 lg:px-12 min-h-screen flex gap-8 lg:gap-12">
        {/* Question area */}
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

          {/* Prev / Next */}
          <div className="flex justify-between items-center pt-8">
            <button
              disabled={current === 0}
              onClick={() => setCurrent(c => c - 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-outline-variant/30 font-headline font-bold text-primary hover:bg-surface-container-low transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Domanda precedente
            </button>
            {current < totalQ - 1 ? (
              <button
                onClick={() => setCurrent(c => c + 1)}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold shadow-editorial hover:opacity-90 active:scale-95 transition-all"
              >
                Domanda successiva
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={timerExpired}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold shadow-editorial hover:opacity-90 active:scale-95 transition-all"
              >
                Consegna esame
                <span className="material-symbols-outlined">check</span>
              </button>
            )}
          </div>
        </div>

        {/* Right sidebar: Question Navigator */}
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-28 bg-surface-container-low rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-headline font-bold text-on-surface">Question Navigator</h3>
              <span className="text-[10px] font-bold text-on-surface-variant/50 tracking-tighter uppercase">FPH 2025</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {test.questions.map((_, i) => {
                const isAnswered = answers[i] !== undefined
                const isCurrent = i === current
                return (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all hover:opacity-80 ${
                      isCurrent
                        ? 'ring-2 ring-primary bg-surface-container-lowest text-primary shadow-sm font-black'
                        : isAnswered
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-4 pt-2 border-t border-outline-variant/20">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Risposto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-surface-container-highest" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Rimanente</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
