import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProgress } from '../hooks/useProgress'
import { fetchSimulations, fetchSimulation } from '../lib/api'
import { AREAS } from '../data/areas'
import UserLayout from '../components/UserLayout'

export default function Stats() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { progress } = useProgress()
  const [simulations, setSimulations] = useState([])
  const [completedTests, setCompletedTests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSimulations()
      .then(async (sims) => {
        setSimulations(sims)
        const completedIds = sims
          .filter(s => progress[s.id]?.status === 'completed')
          .map(s => s.id)
        if (completedIds.length > 0) {
          const full = await Promise.all(completedIds.map(id => fetchSimulation(id).catch(() => null)))
          setCompletedTests(full.filter(Boolean))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const completed = simulations.filter(s => progress[s.id]?.status === 'completed')
  const totalDone = completed.length
  const totalTests = simulations.length
  const totalQuestions = completed.reduce((sum, s) => sum + (progress[s.id]?.total || 0), 0)
  const totalCorrect = completed.reduce((sum, s) => sum + (progress[s.id]?.score || 0), 0)
  const globalPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

  // Per-area stats
  const areaStats = {}
  completed.forEach(sim => {
    const result = progress[sim.id]
    const area = sim.area
    if (!areaStats[area]) areaStats[area] = { correct: 0, total: 0, tests: 0 }
    areaStats[area].correct += result.score || 0
    areaStats[area].total += result.total || 0
    areaStats[area].tests++
  })

  // Per-topic stats from full question data
  const topicErrors = {}
  completedTests.forEach(test => {
    const result = progress[test.id]
    if (!result) return
    test.questions.forEach((q, i) => {
      const ans = result.answers?.[i]
      let correct = false
      if (q.type === 'multiple') correct = ans === q.correct
      else if (q.type === 'truefalse') correct = q.items?.every((item, j) => (ans || {})[j] === item.correct)
      if (q.topic) {
        if (!topicErrors[q.topic]) topicErrors[q.topic] = { wrong: 0, total: 0 }
        topicErrors[q.topic].total++
        if (!correct) topicErrors[q.topic].wrong++
      }
    })
  })

  const weakTopics = Object.entries(topicErrors)
    .filter(([, v]) => v.total > 0)
    .map(([topic, v]) => ({ topic, pct: Math.round((v.wrong / v.total) * 100), ...v }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)

  // SVG ring calculation: r=88, circumference = 2π×88 ≈ 552.92
  const ringCircumference = 552.92
  const ringOffset = ringCircumference * (1 - globalPct / 100)

  if (loading) {
    return (
      <UserLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="p-6 lg:p-12 max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold text-on-surface tracking-tighter mb-2">
            {t('stats.performanceAnalytics')}
          </h1>
          <p className="text-lg text-secondary font-light max-w-2xl">
            {t('stats.statsSubtitle')}
          </p>
        </header>

        {totalDone === 0 ? (
          <div className="card text-center py-16 max-w-md mx-auto">
            <span className="material-symbols-outlined text-[48px] text-outline mb-4 block">analytics</span>
            <h2 className="font-headline font-bold text-xl text-on-surface mb-2">{t('stats.noData')}</h2>
            <p className="text-secondary text-sm mb-6">
              {t('stats.noDataDesc')}
            </p>
            <button className="btn-primary" onClick={() => navigate('/')}>
              {t('stats.goToTests')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Exam Readiness Ring */}
            <div className="md:col-span-4 bg-surface-container-lowest rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-editorial border border-outline-variant/10">
              <h3 className="text-secondary text-sm font-bold uppercase tracking-widest mb-6">{t('stats.examReadiness')}</h3>
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    className="text-surface-container-highest"
                    cx="96" cy="96" r="88"
                    fill="transparent" stroke="currentColor" strokeWidth="12"
                  />
                  <circle
                    className="text-primary"
                    cx="96" cy="96" r="88"
                    fill="transparent" stroke="currentColor" strokeWidth="12"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-headline font-black text-primary">{globalPct}%</span>
                  <span className="text-xs text-secondary font-semibold uppercase">{t('stats.target67')}</span>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="p-4 bg-surface-container-low rounded-xl">
                  <p className="text-2xl font-headline font-bold text-on-surface">{totalDone}</p>
                  <p className="text-[10px] text-secondary uppercase font-bold tracking-tighter">{t('stats.testsDone')}</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-xl">
                  <p className="text-2xl font-headline font-bold text-on-surface">{totalQuestions}</p>
                  <p className="text-[10px] text-secondary uppercase font-bold tracking-tighter">{t('common.questions')}</p>
                </div>
              </div>
            </div>

            {/* Performance Trend */}
            <div className="md:col-span-8 bg-surface-container-low rounded-xl p-8">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h3 className="text-on-surface text-xl font-headline font-bold">{t('stats.performanceTrends')}</h3>
                  <p className="text-secondary text-sm">{t('stats.scorePerSim')}</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-surface-container-lowest rounded-full text-[10px] font-bold text-primary shadow-sm">
                    {t('stats.mockExams')}
                  </span>
                </div>
              </div>
              <div className="h-48 flex items-end justify-start gap-3 px-2 relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-2 text-[10px] text-outline pointer-events-none">
                  <div className="border-b border-outline-variant/20 w-full"><span>100%</span></div>
                  <div className="border-b border-outline-variant/20 w-full"><span>75%</span></div>
                  <div className="border-b border-outline-variant/20 w-full"><span>50%</span></div>
                  <div className="border-b border-outline-variant/20 w-full"><span>25%</span></div>
                </div>
                {/* Bars */}
                <div className="w-full flex items-end justify-around h-40 relative z-10 gap-2">
                  {completed.slice(-8).map((sim, i) => {
                    const r = progress[sim.id]
                    const pct = r?.total > 0 ? Math.round((r.score / r.total) * 100) : 0
                    const barH = Math.round((pct / 100) * 160)
                    const colorClass = pct >= 67 ? 'bg-primary' : pct >= 50 ? 'bg-primary/40' : 'bg-error/60'
                    return (
                      <div key={sim.id} className="group relative flex flex-col items-center gap-2 flex-1">
                        <div
                          className={`${colorClass} w-full max-w-[2.5rem] rounded-t-lg transition-all group-hover:opacity-80`}
                          style={{ height: `${barH}px` }}
                          title={`${sim.title}: ${pct}%`}
                        />
                        <span className="text-[10px] font-bold text-secondary">{i + 1}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Knowledge Map */}
            <div className="md:col-span-7 bg-surface-container-lowest rounded-xl p-8 shadow-editorial">
              <h3 className="text-on-surface text-xl font-headline font-bold mb-6">{t('stats.knowledgeMap')}</h3>
              <div className="space-y-4">
                {Object.entries(areaStats)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([area, stat]) => {
                    const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
                    const areaInfo = AREAS[area]
                    const barColor = pct >= 67 ? 'bg-primary' : pct >= 50 ? 'bg-secondary' : 'bg-error'
                    const labelColor = pct >= 67 ? 'text-primary' : pct >= 50 ? 'text-secondary' : 'text-error'
                    return (
                      <div key={area} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                          <span className={labelColor}>{areaInfo?.name || `Area ${area}`}</span>
                          <span className="text-secondary">{pct}%</span>
                        </div>
                        <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Critical Weak Points + Next Step */}
            <div className="md:col-span-5 flex flex-col gap-6">
              <div className="bg-error-container/30 rounded-xl p-8 border-l-4 border-error">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-error">warning</span>
                  <h3 className="text-on-surface text-lg font-headline font-bold">{t('stats.criticalPoints')}</h3>
                </div>
                {weakTopics.length > 0 ? (
                  <ul className="space-y-4">
                    {weakTopics.map(({ topic, wrong, total, pct }) => (
                      <li key={topic} className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{topic}</p>
                          <p className="text-[10px] text-secondary uppercase tracking-wider">{t('stats.wrongOutOf', { wrong, total })}</p>
                        </div>
                        <span className="text-xs font-black text-error">{pct}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-secondary text-sm">{t('stats.noCritical')}</p>
                )}
              </div>

              <div
                className="bg-surface-container-high rounded-xl p-6 flex items-center justify-between group cursor-pointer hover:bg-surface-container-highest transition-colors"
                onClick={() => navigate('/')}
              >
                <div>
                  <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">{t('stats.nextStep')}</p>
                  <p className="text-on-surface font-headline font-bold">
                    {totalTests - totalDone > 0
                      ? t('stats.remainingSims', { n: totalTests - totalDone })
                      : t('stats.reviewCompleted')}
                  </p>
                </div>
                <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  )
}
