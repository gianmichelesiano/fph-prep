import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import MarkdownView from '../components/MarkdownView'
import { fetchContentByKey, fetchNotebookByKey, fetchNotebooksByArea, fetchStudyPath } from '../lib/notebookContentsApi'
import { supabase } from '../lib/supabase'

// Extract headings (h2/h3) from markdown for TOC generation
function extractHeadings(markdown) {
  if (!markdown) return []
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const headings = []
  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length // 2 or 3
    const text = match[2].trim()
    const slug = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    headings.push({ level, text, slug })
  }
  return headings
}

function TableOfContents({ headings }) {
  if (!headings || headings.length < 3) return null
  const { t } = useTranslation()

  return (
    <nav className="sticky top-24" aria-label={t('study.a4_toc', 'Sommario')}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3 hidden lg:block">
        {t('study.a4_toc', 'Sommario')}
      </h4>
      <ul className="space-y-1.5 border-l-2 border-outline-variant/40 pl-3">
        {headings.map((h, i) => (
          <li key={i}>
            <a
              href={`#${h.slug}`}
              className={`block text-sm py-0.5 transition-colors hover:text-primary ${
                h.level === 3 ? 'pl-3 text-on-surface-variant' : 'text-on-surface font-medium'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MobileTOC({ headings }) {
  if (!headings || headings.length < 3) return null
  const { t } = useTranslation()

  return (
    <details className="lg:hidden mb-6 bg-surface-container-lowest rounded-xl border border-outline-variant/40 overflow-hidden">
      <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-on-surface flex items-center gap-2 hover:bg-surface-container-low transition-colors">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">toc</span>
        {t('study.a4_toc', 'Sommario')}
        <span className="ml-auto text-xs text-on-surface-variant">
          {headings.length} {t('study.a4_sections', 'sezioni')}
        </span>
      </summary>
      <ul className="px-4 pb-3 space-y-1">
        {headings.map((h, i) => (
          <li key={i}>
            <a
              href={`#${h.slug}`}
              className={`block text-sm py-1 hover:text-primary ${
                h.level === 3 ? 'pl-4 text-on-surface-variant' : 'text-on-surface'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}

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
  const [areaName, setAreaName] = useState(null)
  const [notebooks, setNotebooks] = useState([])

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

  // Fetch area name + sibling notebooks for breadcrumb and next/prev
  useEffect(() => {
    if (!data?.area_id) return
    // Fetch area name
    supabase
      .from('areas')
      .select('name')
      .eq('id', data.area_id)
      .single()
      .then(({ data: area }) => {
        if (area) setAreaName(area.name)
      })
      .catch(() => {})
    // Fetch notebooks for this area (ordered by title)
    fetchNotebooksByArea(data.area_id, 'it')
      .then(setNotebooks)
      .catch(() => {})
  }, [data?.area_id])

  useEffect(() => {
    if (!data?.id) return
    fetchStudyPath(data.id)
      .then(setStudyPath)
      .catch(err => console.error('study path fetch error', err))
  }, [data?.id])

  // Compute prev/next from notebooks list
  const { prevNotebook, nextNotebook } = useMemo(() => {
    if (!notebooks.length || !data?.id) return { prevNotebook: null, nextNotebook: null }
    const idx = notebooks.findIndex(n => n.id === data.id)
    if (idx === -1) return { prevNotebook: null, nextNotebook: null }
    return {
      prevNotebook: idx > 0 ? notebooks[idx - 1] : null,
      nextNotebook: idx < notebooks.length - 1 ? notebooks[idx + 1] : null,
    }
  }, [notebooks, data?.id])

  // Extract TOC headings from markdown
  const tocHeadings = useMemo(
    () => extractHeadings(data?.content?.content_md || ''),
    [data?.content?.content_md]
  )

  if (loading) {
    return (
      <UserLayout>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse h-6 w-40 bg-surface-container-high rounded mb-4" />
          <div className="animate-pulse h-64 bg-surface-container-high rounded" />
        </div>
      </UserLayout>
    )
  }

  if (notFound || !data) {
    return (
      <UserLayout>
        <div className="max-w-5xl mx-auto px-4 py-8">
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

  const hasToc = tocHeadings.length >= 3

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-on-surface-variant mb-4 flex-wrap" aria-label="Breadcrumb">
          <Link to="/study" className="hover:text-primary transition-colors">
            {t('study.title', 'Study')}
          </Link>
          <span className="material-symbols-outlined text-[12px] text-outline">chevron_right</span>
          <Link to={`/study/area/${data.area_id}`} className="hover:text-primary transition-colors">
            {areaName || `Area ${data.area_id}`}
          </Link>
          <span className="material-symbols-outlined text-[12px] text-outline">chevron_right</span>
          <span className="text-on-surface truncate max-w-[200px]" aria-current="page">
            {data.title}
          </span>
        </nav>

        <header className="mb-6">
          <h1 className="font-headline font-bold text-3xl text-on-surface">
            {data.title}
          </h1>
          {data.argomento && (
            <p className="text-sm text-on-surface-variant mt-2">{data.argomento}</p>
          )}
        </header>

        {/* Main content area: content + optional TOC sidebar */}
        <div className={`${hasToc ? 'lg:flex lg:gap-10' : ''}`}>
          {/* Content */}
          <div className={`${hasToc ? 'lg:flex-1 lg:min-w-0' : ''}`}>
            {/* Mobile TOC (before content) */}
            <MobileTOC headings={tocHeadings} />

            {data.content && (
              <article>
                <MarkdownView content={data.content.content_md} />
              </article>
            )}

            <StudyPathSection artifacts={studyPath} />
          </div>

          {/* Desktop TOC (sticky sidebar, hidden on mobile) */}
          {hasToc && (
            <aside className="hidden lg:block w-56 shrink-0">
              <TableOfContents headings={tocHeadings} />
            </aside>
          )}
        </div>

        {/* Next/Prev navigation footer */}
        {(prevNotebook || nextNotebook) && (
          <nav className="mt-12 pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row gap-3" aria-label={t('study.a4_topicNav', 'Navigazione argomenti')}>
            <div className="flex-1">
              {prevNotebook ? (
                <Link
                  to={`/study/topic/${prevNotebook.key}`}
                  className="flex items-center gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors group"
                >
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_back</span>
                  <div className="min-w-0">
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                      {t('study.a4_prevTopic', 'Precedente')}
                    </div>
                    <div className="text-sm text-on-surface truncate">{prevNotebook.title}</div>
                  </div>
                </Link>
              ) : (
                <div /> /* spacer for flex alignment */
              )}
            </div>
            <div className="flex-1">
              {nextNotebook ? (
                nextNotebook.hasContent && !nextNotebook.isFree && !isPremium ? (
                  <Link
                    to="/upgrade"
                    className="flex items-center justify-end gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="min-w-0 text-right">
                      <div className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                        {t('study.a4_nextTopic', 'Successivo')}
                      </div>
                      <div className="text-sm text-on-surface truncate flex items-center justify-end gap-1.5">
                        {nextNotebook.title}
                        <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">lock</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
                  </Link>
                ) : (
                  <Link
                    to={`/study/topic/${nextNotebook.key}`}
                    className="flex items-center justify-end gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="min-w-0 text-right">
                      <div className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                        {t('study.a4_nextTopic', 'Successivo')}
                      </div>
                      <div className="text-sm text-on-surface truncate">{nextNotebook.title}</div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
                  </Link>
                )
              ) : (
                <div /> /* spacer for flex alignment */
              )}
            </div>
          </nav>
        )}
      </div>
    </UserLayout>
  )
}
