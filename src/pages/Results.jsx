import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { fetchSimulation } from '../lib/api'
import { AREAS } from '../data/areas'

export default function Results() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { progress, clearResult } = useProgress()
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSimulation(id)
      .then(data => { setTest(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const result = progress[id]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!test || !result) {
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

  const { score, total, answers } = result
  const pct = Math.round((score / total) * 100)
  const passed = pct >= 67

  // SVG ring: r=58, circumference = 2π×58 ≈ 364.4
  const ringCircumference = 364.4
  const ringOffset = ringCircumference * (1 - pct / 100)

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Top navbar */}
      <header className="bg-surface-container-lowest/90 backdrop-blur-md fixed top-0 w-full z-50 shadow-editorial">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="text-xl font-headline font-bold text-primary tracking-tight italic">
            FPH Prep
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-headline font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </button>
        </div>
      </header>

      <main className="pt-24 pb-16 px-4 md:px-12 max-w-7xl mx-auto">
        {/* Hero Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12 items-end">
          <div className="md:col-span-8">
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-2 block">
              Performance Summary
            </span>
            <h1 className="font-headline font-extrabold text-5xl md:text-7xl text-on-surface mb-4">
              Exam Results
            </h1>
            <p className="font-body text-lg text-on-surface-variant max-w-2xl leading-relaxed">
              <span className="font-semibold text-on-surface">{test.title}</span>
              {passed
                ? ' — Ottima prestazione! Continua a focalizzarti sulle aree deboli per raggiungere l\'eccellenza.'
                : ' — Continua a lavorare. Servono almeno il 67% per superare l\'esame FPH.'}
            </p>
          </div>

          {/* Score Ring */}
          <div className="md:col-span-4">
            <div className="bg-surface-container-lowest p-8 rounded-xl flex flex-col items-center gap-4 shadow-editorial w-full">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    className="text-surface-container-high"
                    cx="64" cy="64" r="58"
                    fill="transparent" stroke="currentColor" strokeWidth="8"
                  />
                  <circle
                    className={passed ? 'text-primary' : 'text-error'}
                    cx="64" cy="64" r="58"
                    fill="transparent" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-headline font-extrabold text-3xl">{pct}%</span>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-headline font-bold text-4xl text-on-surface">
                  {Number.isInteger(score) ? score : score.toFixed(1)}/{total}
                </span>
                <div className={`mt-2 px-4 py-1 text-sm font-bold rounded-full border ${
                  passed
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-error-container text-error border-error/20'
                }`}>
                  {passed ? 'PASSATO' : 'NON PASSATO'}
                </div>
                {result.completedAt && (
                  <p className="text-xs text-outline mt-2">
                    {new Date(result.completedAt).toLocaleString('it-IT')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Performance Breakdown + Areas to Improve */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Performance Bars */}
          <div className="lg:col-span-2 bg-surface-container-low p-8 rounded-xl">
            <h2 className="font-headline font-bold text-xl mb-8 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">analytics</span>
              Performance Breakdown
            </h2>
            <div className="space-y-6">
              {/* Overall score bar */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-body font-semibold text-sm text-on-surface">
                    {AREAS[test.area]?.name || `Area ${test.area}`}
                  </span>
                  <span className={`font-headline font-bold ${passed ? 'text-primary' : 'text-error'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${passed ? 'bg-primary' : 'bg-error'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-secondary mt-1">
                  {Number.isInteger(score) ? score : score.toFixed(1)} corrette su {total} domande
                </p>
              </div>
              {/* Threshold marker */}
              <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant font-medium">Soglia di superamento FPH</span>
                  <span className="font-headline font-bold text-secondary">67%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-outline/30 rounded-full" style={{ width: '67%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Areas to Improve + Next Milestone */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-on-tertiary-container p-8 rounded-xl flex-grow border border-tertiary-fixed-dim/30">
              <h2 className="font-headline font-bold text-xl text-on-tertiary-fixed mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary">priority_high</span>
                {passed ? 'Punti di forza' : 'Da migliorare'}
              </h2>
              {passed ? (
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-tertiary text-sm mt-1">star</span>
                    <div>
                      <p className="font-body font-bold text-sm text-on-tertiary-fixed">
                        {AREAS[test.area]?.name || `Area ${test.area}`}
                      </p>
                      <p className="font-body text-xs text-on-tertiary-fixed-variant">
                        Superato con {pct}%
                      </p>
                    </div>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-tertiary text-sm mt-1">school</span>
                    <div>
                      <p className="font-body font-bold text-sm text-on-tertiary-fixed">
                        {AREAS[test.area]?.name || `Area ${test.area}`}
                      </p>
                      <p className="font-body text-xs text-on-tertiary-fixed-variant">
                        {pct}% — ripassare fino al 67%
                      </p>
                    </div>
                  </li>
                </ul>
              )}
            </div>

            <div className="bg-primary text-on-primary p-8 rounded-xl flex flex-col justify-between">
              <div>
                <h3 className="font-headline font-bold text-lg mb-2">Prossimo Obiettivo</h3>
                <p className="font-body text-sm opacity-80 mb-6">
                  {passed
                    ? 'Mantieni questo livello. Prova il prossimo test!'
                    : 'Concentrati sulle aree deboli prima del prossimo tentativo.'}
                </p>
              </div>
              <button
                onClick={() => { clearResult(id); navigate(`/quiz/${id}`) }}
                className="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-headline font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Ripeti questo test
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <section className="mb-12">
          <h2 className="font-headline font-bold text-2xl mb-8 border-b border-outline-variant/20 pb-4">
            Revisione Esame
          </h2>
          <div className="space-y-8">
            {test.questions?.map((q, i) => {
              const ans = answers?.[i]
              let isCorrect = false
              let userAnswerText = 'Non risposto'
              let correctAnswerText = ''

              if (q.type === 'multiple') {
                isCorrect = ans === q.correct
                userAnswerText = ans !== undefined && ans !== null
                  ? (q.options?.[ans] || `Opzione ${ans}`)
                  : 'Non risposto'
                correctAnswerText = q.options?.[q.correct] || `Opzione ${q.correct}`
              } else if (q.type === 'truefalse') {
                const items = q.items || []
                const allCorrect = items.every((item, j) => (ans || {})[j] === item.correct)
                isCorrect = allCorrect
                userAnswerText = 'Risposta K-PRIM fornita'
                correctAnswerText = 'Tutte le affermazioni corrette'
              }

              return (
                <div key={q.id || i} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-editorial">
                  <div className="p-6 bg-surface-container-highest flex justify-between items-center">
                    <span className="font-headline font-bold text-sm text-primary">
                      Domanda {i + 1} — {AREAS[test.area]?.name || 'Farmacia'}
                    </span>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                      isCorrect
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-error-container text-on-error-container'
                    }`}>
                      <span className="material-symbols-outlined text-xs">
                        {isCorrect ? 'check' : 'close'}
                      </span>
                      {isCorrect ? 'CORRETTO' : 'ERRATO'}
                    </div>
                  </div>

                  <div className="p-8">
                    <p className="font-headline text-lg font-bold mb-6 text-on-surface">{q.text}</p>

                    {/* K-PRIM items */}
                    {q.type === 'truefalse' && q.items && (
                      <div className="space-y-2 mb-6">
                        {q.items.map((item, j) => {
                          const userChoice = (ans || {})[j]
                          const itemCorrect = userChoice === item.correct
                          return (
                            <div key={j} className={`flex items-center justify-between p-3 rounded-xl border ${
                              itemCorrect
                                ? 'border-primary/30 bg-secondary-container/20'
                                : 'border-error/30 bg-error-container/20'
                            }`}>
                              <span className="text-sm text-on-surface">{item.text}</span>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs font-bold ${userChoice !== undefined ? 'text-on-surface' : 'text-outline'}`}>
                                  Tu: {userChoice === undefined ? '—' : userChoice ? 'V' : 'F'}
                                </span>
                                <span className="text-xs font-bold text-primary">
                                  Corretto: {item.correct ? 'V' : 'F'}
                                </span>
                                <span className={`material-symbols-outlined text-sm ${itemCorrect ? 'text-primary' : 'text-error'}`}>
                                  {itemCorrect ? 'check_circle' : 'cancel'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Multiple choice answer comparison */}
                    {q.type === 'multiple' && (
                      <div className={`grid gap-4 mb-8 ${isCorrect ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {!isCorrect && (
                          <div className="p-4 rounded-xl border border-error bg-error-container/10">
                            <span className="font-body text-xs text-error font-bold block mb-1">LA TUA RISPOSTA</span>
                            <p className="font-body font-medium text-on-surface">{userAnswerText}</p>
                          </div>
                        )}
                        <div className="p-4 rounded-xl border border-primary bg-secondary-container/20">
                          <span className="font-body text-xs text-primary font-bold block mb-1">
                            {isCorrect ? 'RISPOSTA SELEZIONATA' : 'RISPOSTA CORRETTA'}
                          </span>
                          <p className="font-body font-medium text-on-surface">{correctAnswerText}</p>
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.motivation && (
                      <div className="bg-surface-container-low p-6 rounded-xl">
                        <h4 className="font-headline font-bold text-sm mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">info</span>
                          Motivazione Clinica
                        </h4>
                        <p className="font-body text-sm leading-relaxed text-on-surface-variant">
                          {q.motivation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Final CTA */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-center mt-16">
          <button
            onClick={() => navigate('/')}
            className="px-10 py-5 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-headline font-extrabold text-lg shadow-[0px_12px_32px_rgba(0,95,106,0.2)] hover:scale-[1.02] transition-transform flex items-center gap-3"
          >
            <span className="material-symbols-outlined">dashboard</span>
            Torna al Dashboard
          </button>
          <button
            onClick={() => { clearResult(id); navigate(`/quiz/${id}`) }}
            className="px-10 py-5 bg-transparent border border-outline-variant/40 text-primary rounded-xl font-headline font-extrabold text-lg hover:bg-surface-container-low transition-colors flex items-center gap-3"
          >
            <span className="material-symbols-outlined">refresh</span>
            Ripeti Esame
          </button>
        </section>
      </main>
    </div>
  )
}
