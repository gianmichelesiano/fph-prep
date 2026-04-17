import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UserLayout from '../components/UserLayout'
import { AREAS } from '../data/areas'
import { fetchAreaCounts } from '../lib/notebookContentsApi'

export default function Study() {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAreaCounts('it')
      .then(c => { setCounts(c); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  const areasList = Object.entries(AREAS).map(([id, a]) => ({
    id: Number(id),
    name: a.name,
    color: a.color,
  }))

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-8">
          <h1 className="font-headline font-bold text-3xl text-on-surface">
            {t('study.title', 'Studia')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('study.subtitle', 'Riassunti per area e topic')}
          </p>
        </header>

        {loading ? (
          <div className="text-on-surface-variant">{t('common.loading', 'Caricamento...')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {areasList.map(area => {
              const c = counts[area.id] || { total: 0, withContent: 0 }
              return (
                <Link
                  key={area.id}
                  to={`/study/area/${area.id}`}
                  className="block p-5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color}`}>
                        Area {area.id}
                      </div>
                      <div className="text-on-surface font-semibold mt-2 truncate">
                        {area.name}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1">
                        {t('study.topicsCount', {
                          done: c.withContent,
                          total: c.total,
                          defaultValue: '{{done}}/{{total}} topic con contenuto',
                        })}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant">
                      chevron_right
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </UserLayout>
  )
}
