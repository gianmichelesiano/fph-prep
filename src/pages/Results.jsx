import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchSession } from '../lib/api'
import { AREAS } from '../data/areas'

export default function Results() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSession(sessionId)
      .then(data => { setSession(data); setLoading(false) })
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
            <h3 className="font-headline font-bold text-lg mb-4">Risultati per area</h3>
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
            <h3 className="font-headline font-bold text-lg mb-4">Revisione domande</h3>
            <div className="space-y-4">
              {questions.map((q, i) => {
                const userAnswer = answers?.[q.id]
                let isCorrect = false
                if (q.type === 'multiple') isCorrect = userAnswer === q.correct
                else isCorrect = (q.items || []).every((item, j) => (userAnswer || {})[j] === item.correct)

                return (
                  <div key={q.id} className={`rounded-xl p-5 border-2 ${isCorrect ? 'border-green-200 bg-green-50/30' : 'border-error/20 bg-error-container/10'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`material-symbols-outlined text-lg mt-0.5 ${isCorrect ? 'text-green-600' : 'text-error'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isCorrect ? 'check_circle' : 'cancel'}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs text-outline mb-1">Domanda {i + 1} — {AREAS[q.area]?.name || 'Area ' + q.area}</p>
                        <p className="font-medium text-on-surface leading-snug">{q.text}</p>
                      </div>
                    </div>
                    {q.motivation && (
                      <div className="ml-8 p-3 bg-surface-container rounded-lg">
                        <p className="text-xs text-outline font-semibold mb-1">Spiegazione</p>
                        <p className="text-sm text-on-surface-variant leading-relaxed">{q.motivation}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-10 justify-center">
          <button onClick={() => navigate('/')} className="btn-primary">
            Torna alla home
          </button>
        </div>
      </main>
    </div>
  )
}
