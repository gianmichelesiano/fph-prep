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


function StudyPathSection({ artifacts, notebookKey }) {
  const { t } = useTranslation()
  const [openType, setOpenType] = useState(null)

  const CARDS = [
    { type: 'study_guide', icon: 'menu_book', label: t('study.studyGuide', 'Guida di studio') },
    { type: 'flashcards', icon: 'style', label: t('study.flashcards', 'Flashcard') },
    { type: 'quiz', icon: 'quiz', label: t('study.quiz', 'Quiz') },
  ]

  const artifactByType = Object.fromEntries(artifacts.map(a => [a.type, a]))

  return (
    <section className="mt-10">
      <h2 className="font-headline font-bold text-xl text-on-surface mb-4">
        {t('study.studyPath', 'Percorso di studi')}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(card => {
          const artifact = artifactByType[card.type]
          const available = !!artifact || card.type === 'quiz'
          const isOpen = openType === card.type

          if (card.link) {
            return (
              <Link
                key={card.type}
                to={card.link}
                className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-primary">{card.icon}</span>
                <span className="text-sm font-medium text-on-surface">{card.label}</span>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant ml-auto">chevron_right</span>
              </Link>
            )
          }

          return (
            <div key={card.type} className="col-span-2 sm:col-span-1">
              <button
                disabled={!available}
                onClick={() => available && setOpenType(isOpen ? null : card.type)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors text-left ${
                  available
                    ? 'bg-surface-container-lowest hover:bg-surface-container-low cursor-pointer'
                    : 'bg-surface-container opacity-40 cursor-default'
                }`}
              >
                <span className={`material-symbols-outlined ${available ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {card.icon}
                </span>
                <span className="text-sm font-medium text-on-surface flex-1">{card.label}</span>
                {available && (
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                )}
                {!available && (
                  <span className="text-[10px] text-on-surface-variant">{t('study.comingSoon', 'In arrivo')}</span>
                )}
              </button>

              {isOpen && artifact && card.type === 'study_guide' && (
                <div className="mt-2 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant">
                  <MarkdownView content={artifact.content.text} />
                </div>
              )}

              {isOpen && artifact && card.type === 'flashcards' && (
                <div className="mt-2 space-y-2">
                  {(artifact.content.cards || artifact.content.flashcards || []).map((c, i) => (
                    <FlipCard key={i} card={c} />
                  ))}
                </div>
              )}

              {isOpen && artifact && card.type === 'quiz' && (
                <div className="mt-2 space-y-3">
                  {(artifact.content.questions || artifact.content.quiz || []).map((q, i) => (
                    <div key={i} className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm">
                      <div className="font-semibold text-on-surface mb-2">{i + 1}. {q.question || q.text}</div>
                      {(q.options || q.choices || []).map((o, j) => (
                        <div key={j} className="text-on-surface-variant py-0.5">• {o}</div>
                      ))}
                      <div className="mt-2 text-primary text-xs font-semibold">✓ {q.answer || q.correct_answer || q.correct}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
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

        <StudyPathSection artifacts={studyPath} notebookKey={key} />
      </div>
    </UserLayout>
  )
}
