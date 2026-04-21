import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import MarkdownView from '../components/MarkdownView'
import { fetchContentByKey, fetchNotebookByKey, fetchStudyPath } from '../lib/notebookContentsApi'

function FlipCard({ card }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button
      onClick={() => setFlipped(f => !f)}
      className="w-full text-left p-4 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors min-h-[80px]"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
        {flipped ? 'Risposta' : 'Domanda'}
      </div>
      <div className="text-on-surface text-sm">
        {flipped ? (card.answer || card.a || card.back) : (card.question || card.q || card.front)}
      </div>
    </button>
  )
}


function QuizQuestion({ q, index }) {
  const [selected, setSelected] = useState(null)
  const answered = selected !== null
  const options = q.answerOptions || q.options || q.choices || []

  return (
    <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant">
      <div className="font-semibold text-on-surface mb-3 text-sm">{index + 1}. {q.question || q.text}</div>
      <div className="space-y-2">
        {options.map((o, j) => {
          const text = typeof o === 'string' ? o : o.text
          const correct = typeof o === 'object' && o.isCorrect
          const isSelected = selected === j

          let style = 'border border-outline-variant text-on-surface'
          if (answered) {
            if (correct) style = 'border border-primary bg-primary/10 text-primary font-semibold'
            else if (isSelected) style = 'border border-error bg-error/10 text-error'
            else style = 'border border-outline-variant text-on-surface-variant opacity-60'
          }

          return (
            <button
              key={j}
              disabled={answered}
              onClick={() => setSelected(j)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${style} ${!answered ? 'hover:bg-surface-container-low cursor-pointer' : 'cursor-default'}`}
            >
              {answered && correct && '✓ '}
              {answered && isSelected && !correct && '✗ '}
              {text}
            </button>
          )
        })}
      </div>
      {answered && q.hint && (
        <p className="mt-3 text-xs text-on-surface-variant italic">{q.hint}</p>
      )}
    </div>
  )
}

function StudyPathSection({ artifacts }) {
  const { t } = useTranslation()
  const [active, setActive] = useState(null)

  const TABS = [
    { type: 'study_guide', icon: 'menu_book', label: t('study.studyGuide', 'Guida di studio') },
    { type: 'flashcards', icon: 'style', label: t('study.flashcards', 'Flashcard') },
    { type: 'quiz', icon: 'quiz', label: t('study.quiz', 'Quiz') },
  ]

  const artifactByType = Object.fromEntries(artifacts.map(a => [a.type, a]))
  const artifact = active ? artifactByType[active] : null

  // Auto-select first available on mount
  useState(() => {
    const first = TABS.find(t => artifactByType[t.type])
    if (first) setActive(first.type)
  })

  if (!artifacts.length) return null

  return (
    <section className="mt-10 -mx-4 md:-mx-8">
      <div className="px-4 md:px-8 mb-4">
        <h2 className="font-headline font-bold text-xl text-on-surface">
          {t('study.studyPath', 'Percorso di studi')}
        </h2>
      </div>
      <div className="flex gap-0 border-t border-outline-variant/30 min-h-[60vh]">
        {/* Sidebar */}
        <aside className="w-48 shrink-0 border-r border-outline-variant/30 py-4 px-2 flex flex-col gap-1">
          {TABS.map(tab => {
            const available = !!artifactByType[tab.type]
            const isActive = active === tab.type
            return (
              <button
                key={tab.type}
                disabled={!available}
                onClick={() => available && setActive(tab.type)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full
                  ${isActive ? 'bg-primary/10 text-primary' : available ? 'text-on-surface hover:bg-surface-container-low' : 'text-outline opacity-40 cursor-default'}`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
                {!available && <span className="ml-auto text-[9px] uppercase tracking-wide">{t('study.comingSoon', 'In arrivo')}</span>}
              </button>
            )
          })}
        </aside>

        {/* Content area */}
        <div className="flex-1 py-6 px-6 overflow-y-auto">
          {!active && (
            <p className="text-on-surface-variant text-sm">{t('study.comingSoon', 'Seleziona una sezione.')}</p>
          )}

          {active === 'study_guide' && artifact && (
            <MarkdownView content={artifact.content.text} />
          )}

          {active === 'flashcards' && artifact && (
            <div className="space-y-3 max-w-2xl">
              {(artifact.content.cards || artifact.content.flashcards || []).map((c, i) => (
                <FlipCard key={i} card={c} />
              ))}
            </div>
          )}

          {active === 'quiz' && artifact && (
            <div className="space-y-4 max-w-2xl">
              {(artifact.content.questions || artifact.content.quiz || []).map((q, i) => (
                <QuizQuestion key={i} q={q} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function StudyTopic() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [studyPath, setStudyPath] = useState([])

  const isPremium = profile?.is_premium || profile?.is_admin

  useEffect(() => {
    fetchContentByKey(key, 'it')
      .then(async res => {
        if (res?.content && !res.content.is_free && !isPremium) {
          navigate('/upgrade', { replace: true })
          return
        }
        if (res) { setData(res); setLoading(false); return }
        // No content yet — load bare notebook metadata
        const nb = await fetchNotebookByKey(key)
        if (!nb) { setNotFound(true); setLoading(false); return }
        setData({ ...nb, content: null })
        setLoading(false)
      })
      .catch(err => { console.error(err); setNotFound(true); setLoading(false) })
  }, [key, isPremium, navigate])

  useEffect(() => {
    if (!data?.id) return
    fetchStudyPath(data.id)
      .then(setStudyPath)
      .catch(err => console.error('study path fetch error', err))
  }, [data?.id])

  if (loading) {
    return (
      <UserLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse h-6 w-40 bg-surface-container-high rounded mb-4" />
          <div className="animate-pulse h-64 bg-surface-container-high rounded" />
        </div>
      </UserLayout>
    )
  }

  if (notFound || !data) {
    return (
      <UserLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-on-surface-variant mb-4">
            {t('study.topicNotFound', 'Topic non trovato o contenuto non ancora disponibile.')}
          </p>
          <Link to="/study" className="text-primary underline">
            ← {t('study.backToAreas', 'Torna alle aree')}
          </Link>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <Link
          to={`/study/area/${data.area_id}`}
          className="text-sm text-primary flex items-center gap-1 mb-4"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('study.backToArea', 'Area {{id}}', { id: data.area_id })}
        </Link>

        <header className="mb-6">
          <h1 className="font-headline font-bold text-3xl text-on-surface">
            {data.title}
          </h1>
          {data.argomento && (
            <p className="text-sm text-on-surface-variant mt-2">{data.argomento}</p>
          )}
        </header>

        {data.content && (
          <article>
            <MarkdownView content={data.content.content_md} />
          </article>
        )}

        <StudyPathSection artifacts={studyPath} />
      </div>
    </UserLayout>
  )
}
