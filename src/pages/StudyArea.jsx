import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import { AREAS } from '../data/areas'
import { fetchNotebooksByArea } from '../lib/notebookContentsApi'

export default function StudyArea() {
  const { area_id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [notebooks, setNotebooks] = useState([])
  const [loading, setLoading] = useState(true)

  const areaId = Number(area_id)
  const area = AREAS[areaId]

  const isPremium = profile?.is_premium || profile?.is_admin

  useEffect(() => {
    if (!area) { setLoading(false); return }
    fetchNotebooksByArea(areaId, 'it')
      .then(list => { setNotebooks(list); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [areaId, area])

  if (!area) {
    return (
      <UserLayout>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <p className="text-on-surface-variant">{t('study.areaNotFound', 'Area non trovata.')}</p>
          <Link to="/study" className="text-primary underline">← {t('study.backToAreas', 'Torna alle aree')}</Link>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <Link to="/study" className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('study.backToAreas', 'Aree')}
        </Link>

        <header className="mb-6">
          <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color}`}>
            Area {areaId}
          </div>
          <h1 className="font-headline font-bold text-3xl text-on-surface mt-2">
            {area.name}
          </h1>
        </header>

        {loading ? (
          <div className="text-on-surface-variant">{t('common.loading', 'Caricamento...')}</div>
        ) : notebooks.length === 0 ? (
          <p className="text-on-surface-variant">{t('study.noTopics', 'Nessun topic disponibile.')}</p>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {notebooks.map(n => {
              const locked = !n.isFree && !isPremium
              const disabled = !n.hasContent
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (disabled) return
                    if (locked) navigate('/upgrade')
                    else navigate(`/study/topic/${n.key}`)
                  }}
                  disabled={disabled}
                  className={`w-full text-left py-4 flex items-center justify-between gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container-lowest'} rounded-md px-3 transition-colors`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-on-surface">{n.title}</div>
                    {n.argomento && (
                      <div className="text-xs text-on-surface-variant truncate mt-0.5">{n.argomento}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.hasContent && (
                      <span className="text-[10px] text-outline uppercase tracking-wider">
                        {t('study.notReady', 'In preparazione')}
                      </span>
                    )}
                    {n.hasContent && n.isFree && (
                      <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10">
                        Free
                      </span>
                    )}
                    {n.hasContent && locked && (
                      <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                    )}
                    {n.hasContent && !locked && (
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </UserLayout>
  )
}
