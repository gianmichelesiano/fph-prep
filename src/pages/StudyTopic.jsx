import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import MarkdownView from '../components/MarkdownView'
import { fetchContentByKey } from '../lib/notebookContentsApi'

export default function StudyTopic() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const isPremium = profile?.is_premium || profile?.is_admin

  useEffect(() => {
    fetchContentByKey(key, 'it')
      .then(res => {
        if (!res || !res.content) { setNotFound(true); setLoading(false); return }
        if (!res.content.is_free && !isPremium) {
          navigate('/upgrade', { replace: true })
          return
        }
        setData(res)
        setLoading(false)
      })
      .catch(err => { console.error(err); setNotFound(true); setLoading(false) })
  }, [key, isPremium, navigate])

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

        <article>
          <MarkdownView content={data.content.content_md} />
        </article>
      </div>
    </UserLayout>
  )
}
