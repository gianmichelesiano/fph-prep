import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import { fetchAreaDetail, fetchAreaQuestions, startAreaQuiz, submitAreaQuiz, fetchAreaProgress } from '../lib/areasApi'
import { fetchNotebooksByArea } from '../lib/notebookContentsApi'

const TABS = ['overview', 'questions', 'quiz', 'progress']

export default function StudyArea() {
  const { area_id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const areaId = Number(area_id)

  const [area, setArea] = useState(null)
  const [topics, setTopics] = useState([])
  const [notebooks, setNotebooks] = useState([])
  const [questions, setQuestions] = useState([])
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState(null)

  // Question bank filters
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Mini-quiz state
  const [quizConfig, setQuizConfig] = useState({ question_count: 10, format: 'mixed', timed: false, time_minutes: null, only_errors: false })
  const [quiz, setQuiz] = useState(null) // { quiz_id, questions, currentIndex, answers, startTime }
  const [quizResult, setQuizResult] = useState(null)

  useEffect(() => {
    loadData()
  }, [areaId])

  function loadData() {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchAreaDetail(areaId),
      fetchAreaQuestions(areaId).catch(() => []),
      fetchAreaProgress(areaId).catch(() => null),
      fetchNotebooksByArea(areaId, 'it').catch(() => []),
    ])
      .then(([detail, qs, prog, nbs]) => {
        setArea(detail.area)
        setTopics(detail.topics)
        setQuestions(qs)
        setProgress(prog)
        setNotebooks(nbs)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  function handleStartQuiz() {
    startAreaQuiz(areaId, quizConfig)
      .then(data => {
        setQuiz({
          quiz_id: data.quiz_id,
          questions: data.questions,
          currentIndex: 0,
          answers: {},
          startTime: Date.now(),
        })
        setTab('quiz')
      })
      .catch(e => setError(e.message))
  }

  function handleAnswer(questionId, answer) {
    setQuiz(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }))
  }

  function handleNextQuestion() {
    if (quiz.currentIndex < quiz.questions.length - 1) {
      setQuiz(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
    }
  }

  function handlePrevQuestion() {
    if (quiz.currentIndex > 0) {
      setQuiz(prev => ({ ...prev, currentIndex: prev.currentIndex - 1 }))
    }
  }

  async function handleSubmitQuiz() {
    const result = await submitAreaQuiz(quiz.quiz_id, quiz.answers)
    setQuizResult({ ...result, timeTaken: Math.round((Date.now() - quiz.startTime) / 1000) })
    setQuiz(null)
    loadData() // refresh progress
  }

  // Hooks: sempre prima degli early return (ordine hook stabile tra i render)
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (filterTopic && q.topic_id !== filterTopic) return false
      if (filterDifficulty && q.difficulty !== filterDifficulty) return false
      if (searchQuery.trim()) {
        const normText = normalize(q.text)
        const normQuery = normalize(searchQuery)
        if (!normText.includes(normQuery)) return false
      }
      return true
    })
  }, [questions, filterTopic, filterDifficulty, searchQuery])

  // Content read tracking (client-side localStorage, will migrate to DB)
  const contentReadStats = useMemo(() => {
    const nbWithContent = notebooks.filter(n => n.hasContent)
    if (!user?.id || nbWithContent.length === 0) {
      return { readCount: 0, total: nbWithContent.length, notebooks: nbWithContent.map(n => ({ ...n, isRead: false })) }
    }
    const enriched = nbWithContent.map(n => {
      const isRead = !!localStorage.getItem(`fph_content_read_${user.id}_${n.id}`)
      return { ...n, isRead }
    })
    const readCount = enriched.filter(n => n.isRead).length
    return { readCount, total: enriched.length, notebooks: enriched }
  }, [notebooks, user?.id])

  if (loading) {
    return (
      <UserLayout>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 text-on-surface-variant">
          {t('common.loading', 'Caricamento...')}
        </div>
      </UserLayout>
    )
  }

  if (error || !area) {
    return (
      <UserLayout>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <p className="text-on-surface-variant">{error || t('study.areaNotFound', 'Area non trovata.')}</p>
          <Link to="/study" className="text-primary underline">← {t('study.backToAreas', 'Torna alle aree')}</Link>
        </div>
      </UserLayout>
    )
  }

  // Accent-insensitive normalize helper
  function normalize(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  // Highlight matching text in question
  function highlightText(text, query) {
    if (!query || !query.trim()) return text
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-100 text-inherit rounded-sm px-0.5">{part}</mark>
        : part
    )
  }

  const isHighlighted = area.role_number === 4

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <Link to="/study" className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('study.backToAreas', 'Ruoli')}
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color_class || 'bg-surface-container-high text-on-surface-variant'}`}>
              {t('study.role', { n: area.role_number || area.id, defaultValue: `Ruolo ${area.role_number || area.id}` })}
            </div>
            {isHighlighted && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">50% esame</span>
            )}
          </div>
          <h1 className="font-headline font-bold text-3xl text-on-surface">{area.name}</h1>

          <div className="flex gap-4 mt-3 text-sm text-on-surface-variant">
            <span>Peso: <strong className="text-on-surface">{area.weight_percent ?? '–'}%</strong></span>
            <span>{t('study.studyDays', 'Giorni studio')}: <strong className="text-on-surface">{area.study_days ?? '–'}</strong></span>
            <span>Domande: <strong className="text-on-surface">{questions.length}</strong></span>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-outline-variant/20 mb-6">
          {TABS.map(tabKey => (
            <button
              key={tabKey}
              onClick={() => { setTab(tabKey); setQuiz(null); setQuizResult(null) }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
                tab === tabKey
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tabKey === 'overview' && (t('study.overview', 'Panoramica'))}
              {tabKey === 'questions' && (t('study.questionBank', 'Domande'))}
              {tabKey === 'quiz' && (t('study.miniQuiz', 'Mini-Quiz'))}
              {tabKey === 'progress' && (t('study.progress', 'Progresso'))}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <div>
            {area.description && (
              <div className="card mb-6">
                <h3 className="font-bold text-on-surface mb-2">{t('study.description', 'Descrizione')}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{area.description}</p>
              </div>
            )}

            {area.learning_objectives && area.learning_objectives.length > 0 && (
              <div className="card mb-6">
                <h3 className="font-bold text-on-surface mb-4">{t('study.learningObjectives', 'Obiettivi di apprendimento')}</h3>
                <div className="space-y-2">
                  {(Array.isArray(area.learning_objectives) ? area.learning_objectives : []).map((obj, idx) => {
                    const text = typeof obj === 'string' ? obj : obj?.objective || ''
                    const cat = typeof obj === 'object' ? obj?.category : null
                    return (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 shrink-0">check_circle_outline</span>
                        <div>
                          <span className="text-on-surface">{text}</span>
                          {cat && <span className="text-[10px] text-outline uppercase ml-2">({cat})</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {topics.length > 0 && (
              <div className="card mb-6">
                <h3 className="font-bold text-on-surface mb-4">{t('study.topicsCovered', 'Topics')} ({topics.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {topics.map(topic => (
                    <div key={topic.id} className="p-3 rounded-lg bg-surface-container-low">
                      <button
                        onClick={() => { setFilterTopic(topic.id); setTab('questions') }}
                        className="text-sm font-semibold text-primary hover:underline text-left"
                      >
                        {topic.name}
                      </button>
                      {topic.description && (
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{topic.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notebooks.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-on-surface mb-4">{t('study.availableContent', 'Contenuti disponibili')} ({notebooks.length})</h3>
                <div className="divide-y divide-outline-variant/10">
                  {notebooks.map(n => (
                    <button
                      key={n.id}
                      onClick={() => navigate(`/study/topic/${n.key || n.id}`)}
                      className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-surface-container-low rounded-md px-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-on-surface text-sm">{n.title}</div>
                        {n.argomento && (
                          <div className="text-xs text-on-surface-variant truncate mt-0.5">{n.argomento}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {n.hasContent ? (
                          <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10">
                            {n.isFree ? 'Free' : 'Premium'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-outline uppercase tracking-wider">In preparazione</span>
                        )}
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {topics.length === 0 && notebooks.length === 0 && (
              <div className="card text-center py-8 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-[32px] block mb-2 text-outline">auto_awesome</span>
                {t('study.noContentYet', 'Contenuti in arrivo. Il team sta preparando materiale per quest\'area.')}
              </div>
            )}
          </div>
        )}

        {/* Tab: Question Bank */}
        {tab === 'questions' && (
          <div>
            {/* Search + Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">search</span>
                <input
                  type="text"
                  className="input text-sm w-full pl-10"
                  placeholder={t('study.searchQuestions', 'Cerca nelle domande...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <select
                  className="input text-sm"
                  value={filterTopic}
                  onChange={e => setFilterTopic(e.target.value)}
                >
                  <option value="">{t('study.allTopics', 'Tutti i topic')}</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select
                  className="input text-sm"
                  value={filterDifficulty}
                  onChange={e => setFilterDifficulty(e.target.value)}
                >
                  <option value="">{t('study.allDifficulties', 'Tutte le difficoltà')}</option>
                  <option value="easy">{t('study.easy', 'Facile')}</option>
                  <option value="medium">{t('study.medium', 'Media')}</option>
                  <option value="hard">{t('study.hard', 'Difficile')}</option>
                </select>
              </div>
              <span className="text-sm text-on-surface-variant self-center whitespace-nowrap">
                {filteredQuestions.length} {t('study.questionsFound', 'domande')}
              </span>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-[40px] block mb-3 text-outline">search_off</span>
                <p className="text-sm text-on-surface-variant mb-4">
                  {(searchQuery || filterTopic || filterDifficulty)
                    ? t('study.noQuestionsFound', { query: searchQuery, defaultValue: `Nessuna domanda trovata per '${searchQuery}'` })
                    : t('study.noQuestions', 'Nessuna domanda trovata.')
                  }
                </p>
                {(searchQuery || filterTopic || filterDifficulty) && (
                  <button
                    onClick={() => { setSearchQuery(''); setFilterTopic(''); setFilterDifficulty('') }}
                    className="btn-secondary text-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                    {t('study.clearFilters', 'Pulisci filtri')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map(q => {
                  const topic = topics.find(t => t.id === q.topic_id)
                  return (
                    <div key={q.id} className="card p-4 hover:bg-surface-container-low transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-on-surface leading-snug">{highlightText(q.text, searchQuery)}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${q.type === 'multiple_choice' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
                              {q.type === 'multiple_choice' ? 'MC-A' : 'K-Prim'}
                            </span>
                            {topic && (
                              <span className="text-[11px] text-on-surface-variant">{topic.name}</span>
                            )}
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-outline shrink-0">chevron_right</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Mini-Quiz */}
        {tab === 'quiz' && !quiz && !quizResult && (
          <div className="card max-w-lg">
            <h3 className="font-bold text-on-surface mb-4">{t('study.miniQuizConfig', 'Configura Mini-Quiz')}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-on-surface-variant mb-1 block">
                  {t('study.questionsNumber', 'Numero domande')}
                </label>
                <div className="flex gap-2">
                  {[5, 10, 20, -1].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuizConfig(prev => ({ ...prev, question_count: n }))}
                      className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                        quizConfig.question_count === n
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {n === -1 ? t('study.all', 'Tutte') : n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-on-surface-variant mb-1 block">
                  {t('study.format', 'Formato')}
                </label>
                <div className="flex gap-2">
                  {[
                    { key: 'mixed', label: t('study.mixed', 'Misto') },
                    { key: 'MC-A', label: 'MC-A' },
                    { key: 'MC-Kprime', label: 'K-Prim' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setQuizConfig(prev => ({ ...prev, format: f.key }))}
                      className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                        quizConfig.format === f.key
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={quizConfig.only_errors}
                  onChange={e => setQuizConfig(prev => ({ ...prev, only_errors: e.target.checked }))}
                  className="rounded"
                />
                {t('study.onlyErrors', 'Solo domande sbagliate in precedenza')}
              </label>

              <div className="pt-2">
                <button onClick={handleStartQuiz} className="btn-primary w-full">
                  {t('study.startQuiz', 'Inizia Quiz')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz in progress */}
        {tab === 'quiz' && quiz && (
          <QuizPlayer
            quiz={quiz}
            onAnswer={handleAnswer}
            onNext={handleNextQuestion}
            onPrev={handlePrevQuestion}
            onSubmit={handleSubmitQuiz}
            t={t}
          />
        )}

        {/* Quiz results */}
        {tab === 'quiz' && quizResult && (
          <QuizResults
            result={quizResult}
            onBackToStudy={() => { setQuizResult(null); setTab('overview') }}
            onRetryErrors={() => {
              setQuizConfig(prev => ({ ...prev, only_errors: true }))
              setQuizResult(null)
              handleStartQuiz()
            }}
            t={t}
          />
        )}

        {/* Tab: Progress */}
        {tab === 'progress' && (
          <div>
            {/* Questions progress */}
            <div className="card mb-6">
              <h3 className="font-bold text-on-surface mb-4">{t('study.questionsProgress', 'Domande')}</h3>
              {progress ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
                    <div>
                      <div className="text-2xl font-bold text-primary">{progress.questions_completed || 0}</div>
                      <div className="text-xs text-on-surface-variant mt-1">{t('study.questionsFaced', 'Domande affrontate')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{progress.questions_correct || 0}</div>
                      <div className="text-xs text-on-surface-variant mt-1">{t('study.correctQs', 'Risposte corrette')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {progress.questions_completed > 0
                          ? Math.round((progress.questions_correct / progress.questions_completed) * 100)
                          : 0}%
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1">{t('study.accuracy', 'Accuratezza')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {progress.avg_time_seconds ? `${Math.round(progress.avg_time_seconds)}s` : '–'}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1">{t('study.avgTimePerQuestion', 'Tempo medio/domanda')}</div>
                    </div>
                  </div>

                  {/* Questions progress bar */}
                  <div className="mb-1">
                    <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                      <span>{t('study.questionsFaced', 'Domande affrontate')}</span>
                      <span>{progress.questions_completed || 0} / {questions.length}</span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${questions.length > 0 ? Math.round((progress.questions_completed / questions.length) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">{t('study.noProgress', 'Nessun progresso ancora. Inizia un quiz!')}</p>
              )}
            </div>

            {/* Content progress */}
            {contentReadStats.total > 0 && (
              <div className="card mb-6">
                <h3 className="font-bold text-on-surface mb-4">{t('study.contentProgress', 'Contenuti')}</h3>

                {/* Content progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                    <span>{t('study.contentRead', 'Contenuti letti')}</span>
                    <span>{contentReadStats.readCount} / {contentReadStats.total}</span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2">
                    <div
                      className="bg-tertiary h-2 rounded-full transition-all"
                      style={{ width: `${contentReadStats.total > 0 ? Math.round((contentReadStats.readCount / contentReadStats.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Notebook list */}
                <div className="space-y-1">
                  {contentReadStats.notebooks.map(n => (
                    <button
                      key={n.id}
                      onClick={() => navigate(`/study/topic/${n.key || n.id}`)}
                      className="w-full text-left flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-container-low transition-colors"
                    >
                      <span className={`material-symbols-outlined text-[18px] shrink-0 ${n.isRead ? 'text-primary' : 'text-outline'}`}>
                        {n.isRead ? 'menu_book' : 'menu_book'}
                      </span>
                      <span className="text-sm text-on-surface truncate flex-1">{n.title}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${n.isRead ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {n.isRead ? t('study.readLabel', 'Letto') : t('study.unreadLabel', 'Da leggere')}
                      </span>
                    </button>
                  ))}
                </div>
                {!user && (
                  <p className="text-[11px] text-on-surface-variant/60 mt-3 italic">
                    {t('study.loginToTrack', 'Accedi per salvare i progressi di lettura.')}
                  </p>
                )}
              </div>
            )}

            {/* Smart recommendation (unchanged) */}
            {progress && area.weight_percent && (
              <div className="card">
                <h3 className="font-bold text-on-surface mb-3">{t('study.recommendations', 'Suggerimenti')}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {progress.questions_completed > 0
                    ? (progress.questions_correct / progress.questions_completed) < 0.67
                      ? t('study.recoLow', { name: area.name, weight: area.weight_percent, defaultValue: `Il tuo punteggio in ${area.name} è sotto il 67%. Dedica più tempo allo studio di quest'area — pesa il ${area.weight_percent}% dell'esame.` })
                      : t('study.recoGood', { name: area.name, defaultValue: `Buon lavoro in ${area.name}! Continua a esercitarti per mantenere il livello.` })
                    : t('study.recoStart', { name: area.name, weight: area.weight_percent, defaultValue: `Inizia a fare quiz in ${area.name}. Quest'area pesa il ${area.weight_percent}% dell'esame — è importante padroneggiarla.` })
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </UserLayout>
  )
}

function QuizPlayer({ quiz, onAnswer, onNext, onPrev, onSubmit, t }) {
  const q = quiz.questions[quiz.currentIndex]
  const answer = quiz.answers[q?.id]

  if (!q) return null

  const isLast = quiz.currentIndex === quiz.questions.length - 1
  const answeredCount = Object.keys(quiz.answers).length
  const allAnswered = answeredCount === quiz.questions.length

  return (
    <div className="max-w-2xl">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="text-on-surface-variant">
          {t('quiz.question', { n: quiz.currentIndex + 1, total: quiz.questions.length, defaultValue: `Domanda ${quiz.currentIndex + 1}/${quiz.questions.length}` })}
        </span>
        <span className="text-on-surface-variant">
          {answeredCount}/{quiz.questions.length} {t('quiz.answered', 'risposte')}
        </span>
      </div>
      <div className="w-full bg-surface-container-high rounded-full h-1.5 mb-6">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${Math.round((answeredCount / quiz.questions.length) * 100)}%` }}
        />
      </div>

      {/* Question card */}
      <div className="card mb-4">
        <div className="flex items-start gap-2 mb-4">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${q.type === 'multiple_choice' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
            {q.type === 'multiple_choice' ? 'MC-A' : 'K-Prim'}
          </span>
          <p className="text-on-surface font-semibold">{q.text}</p>
        </div>

        {q.type === 'multiple_choice' && q.options && (
          <div className="space-y-2">
            {Object.entries(q.options).map(([key, val]) => (
              <button
                key={key}
                onClick={() => onAnswer(q.id, key)}
                className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                  answer === key
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="font-bold mr-2">{key}.</span>
                {val}
              </button>
            ))}
          </div>
        )}

        {q.type === 'kprim' && q.options && (
          <div className="space-y-2">
            {Object.entries(q.options).map(([key, val]) => {
              const itemAnswer = answer?.[key]
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/20 text-sm">
                  <span className="text-on-surface-variant flex-1">{val}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAnswer(q.id, { ...answer, [key]: true })}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${
                        itemAnswer === true
                          ? 'border-green-500 bg-green-50 text-green-700 font-bold'
                          : 'border-outline-variant/20 text-on-surface-variant'
                      }`}
                    >
                      V
                    </button>
                    <button
                      onClick={() => onAnswer(q.id, { ...answer, [key]: false })}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${
                        itemAnswer === false
                          ? 'border-red-500 bg-red-50 text-red-700 font-bold'
                          : 'border-outline-variant/20 text-on-surface-variant'
                      }`}
                    >
                      F
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={quiz.currentIndex === 0}
          className="btn-secondary text-sm disabled:opacity-30"
        >
          ← {t('quiz.prev', 'Prec')}
        </button>

        {isLast ? (
          <button
            onClick={onSubmit}
            disabled={!allAnswered}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {t('quiz.submit', 'Consegna')} ({answeredCount}/{quiz.questions.length})
          </button>
        ) : (
          <button onClick={onNext} className="btn-primary text-sm">
            {t('quiz.next', 'Succ')} →
          </button>
        )}
      </div>
    </div>
  )
}

function QuizResults({ result, onBackToStudy, onRetryErrors, t }) {
  const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0
  const passed = pct >= 67

  return (
    <div className="max-w-2xl">
      <div className={`card mb-6 text-center p-6 ${passed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="text-4xl font-bold mb-2">{pct}%</div>
        <div className="text-lg font-semibold text-on-surface mb-1">
          {passed ? t('quiz.passed', 'Quiz Superato!') : t('quiz.notPassed', 'Continua a studiare')}
        </div>
        <div className="text-sm text-on-surface-variant">
          {result.score}/{result.total} {t('quiz.correct', 'corrette')}
          {result.timeTaken && ` · ${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s`}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {result.results.map((r, i) => (
          <div key={i} className={`card border-l-4 p-4 ${r.is_correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {r.is_correct ? '✓' : '✗'}
              </span>
              <span className="text-xs text-on-surface-variant">{t('quiz.questionNum', { n: i + 1 })}</span>
            </div>
            {r.explanation && (
              <p className="text-sm text-on-surface-variant leading-relaxed">{r.explanation}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBackToStudy} className="btn-secondary flex-1">
          {t('quiz.backToStudy', 'Torna all\'area')}
        </button>
        <button onClick={onRetryErrors} className="btn-primary flex-1">
          {t('quiz.retryErrors', 'Riprova errori')}
        </button>
      </div>
    </div>
  )
}
