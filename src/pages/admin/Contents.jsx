import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { AREAS } from '../../data/areas'
import { fetchAllNotebooksAdmin } from '../../lib/notebookContentsApi'
import { fetchResources } from '../../lib/adminBackendApi'

const LANGS = [
  { code: 'it', label: 'IT', native: 'Italiano' },
  { code: 'de', label: 'DE', native: 'Deutsch' },
  { code: 'fr', label: 'FR', native: 'Français' },
  { code: 'en', label: 'EN', native: 'English' },
]

const LANG_FLAGS = { it: '🇮🇹', de: '🇩🇪', fr: '🇫🇷', en: '🇬🇧' }
const EMPTY_ITEMS = []

export default function AdminContents() {
  const navigate = useNavigate()
  const [itemsByLang, setItemsByLang] = useState({})
  const [filterArea, setFilterArea] = useState('all')
  const [lang, setLang] = useState('it')
  const [tab, setTab] = useState('notebooks')
  const [resources, setResources] = useState([])
  const [resourcesLoaded, setResourcesLoaded] = useState(false)
  const [resourceSearch, setResourceSearch] = useState('')
  const hasLoadedLang = Object.prototype.hasOwnProperty.call(itemsByLang, lang)
  const items = itemsByLang[lang] || EMPTY_ITEMS
  const loading = !hasLoadedLang
  const resourcesLoading = tab === 'resources' && !resourcesLoaded

  useEffect(() => {
    if (hasLoadedLang) return
    let cancelled = false
    fetchAllNotebooksAdmin(lang)
      .then(data => {
        if (!cancelled) {
          setItemsByLang(prev => ({ ...prev, [lang]: data }))
        }
      })
      .catch(err => {
        console.error(err)
        if (!cancelled) {
          setItemsByLang(prev => ({ ...prev, [lang]: [] }))
        }
      })
    return () => { cancelled = true }
  }, [lang, hasLoadedLang])

  useEffect(() => {
    if (tab !== 'resources' || resourcesLoaded) return
    let cancelled = false
    fetchResources({ limit: 500 })
      .then(data => {
        if (!cancelled) {
          setResources(data || [])
          setResourcesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResourcesLoaded(true)
        }
      })
    return () => { cancelled = true }
  }, [tab, resourcesLoaded])

  const filteredResources = useMemo(() => {
    if (!resourceSearch.trim()) return resources
    const q = resourceSearch.toLowerCase()
    return resources.filter(r =>
      (r.title || r.name || '').toLowerCase().includes(q) ||
      (r.type || '').toLowerCase().includes(q)
    )
  }, [resources, resourceSearch])

  const filtered = useMemo(() => {
    if (filterArea === 'all') return items
    return items.filter(i => i.area_id === Number(filterArea))
  }, [items, filterArea])

  const stats = useMemo(() => {
    const total = items.length
    const withContent = items.filter(i => i.hasContent).length
    return { total, withContent }
  }, [items])

  // Coverage stats per lingua
  const coverageStats = useMemo(() => {
    const s = {}
    for (const l of LANGS) {
      const withL = items.filter(i => i.availableLangs?.includes(l.code)).length
      s[l.code] = { total: items.length, withContent: withL }
    }
    return s
  }, [items])

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">Contents</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {stats.withContent}/{stats.total} notebook con contenuto ({lang.toUpperCase()})
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Language selector */}
            <div className="flex bg-surface-container rounded-lg p-0.5">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    lang === l.code
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  title={l.native}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <select
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              className="px-3 py-2 bg-surface-container rounded-lg text-sm"
            >
              <option value="all">Tutti i ruoli</option>
              {Object.entries(AREAS).map(([id, a]) => (
                <option key={id} value={id}>Ruolo {id} — {a.name}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-outline-variant/20 mb-6">
          {[
            { key: 'notebooks', label: 'Notebook' },
            { key: 'resources', label: 'Risorse' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'notebooks' && (
        <>

        {/* Coverage matrix */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          {LANGS.map(l => {
            const cs = coverageStats[l.code] || { total: 0, withContent: 0 }
            const pct = cs.total > 0 ? Math.round((cs.withContent / cs.total) * 100) : 0
            return (
              <div key={l.code} className={`bg-surface-container-lowest rounded-xl p-4 text-center ${lang === l.code ? 'ring-2 ring-primary' : ''}`}>
                <div className="text-lg mb-1">{LANG_FLAGS[l.code]}</div>
                <div className="font-headline font-bold text-xl text-on-surface">{pct}%</div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">
                  {l.native} ({cs.withContent}/{cs.total})
                </div>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="text-on-surface-variant">Caricamento...</div>
        ) : (
          <div className="rounded-xl bg-surface-container-lowest overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-left text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">Key</th>
                  <th className="px-4 py-3 font-semibold">Titolo</th>
                  <th className="px-4 py-3 font-semibold">Ruolo</th>
                  <th className="px-4 py-3 font-semibold">Stato</th>
                  <th className="px-4 py-3 font-semibold">Lingue</th>
                  <th className="px-4 py-3 font-semibold">Free</th>
                  <th className="px-4 py-3 font-semibold">Aggiornato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map(n => (
                  <tr
                    key={n.id}
                    className="hover:bg-surface-container-low cursor-pointer"
                    onClick={() => navigate(`/admin/contents/${n.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{n.key}</td>
                    <td className="px-4 py-3 text-on-surface">{n.title}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{n.area_id}</td>
                    <td className="px-4 py-3">
                      {n.hasContent ? (
                        <span className="text-xs font-semibold text-green-700">✓ Pronto</span>
                      ) : (
                        <span className="text-xs text-outline">✗ Vuoto</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {LANGS.map(l => {
                          const has = n.availableLangs?.includes(l.code)
                          return (
                            <span
                              key={l.code}
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                has
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-surface-container-highest text-outline'
                              }`}
                              title={has ? `${l.native}: presente` : `${l.native}: assente`}
                            >
                              {l.label}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {n.hasContent && n.isFree ? (
                        <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10">Free</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('it-IT') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        </>
        )}

        {tab === 'resources' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">search</span>
                <input
                  className="input text-sm w-full pl-10"
                  placeholder="Cerca risorse..."
                  value={resourceSearch}
                  onChange={e => setResourceSearch(e.target.value)}
                />
              </div>
              <span className="text-sm text-on-surface-variant">{filteredResources.length} risorse</span>
            </div>

            {resourcesLoading ? (
              <p className="text-sm text-outline">Caricamento...</p>
            ) : filteredResources.length === 0 ? (
              <p className="text-sm text-outline">Nessuna risorsa trovata.</p>
            ) : (
              <div className="rounded-xl bg-surface-container-lowest overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-low">
                    <tr className="text-left text-on-surface-variant">
                      <th className="px-4 py-3 font-semibold">Titolo</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Notebook</th>
                      <th className="px-4 py-3 font-semibold">Lingua</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {filteredResources.map(r => (
                      <tr key={r.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-3 text-on-surface">{r.title || r.name || `#${r.id}`}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                            {r.type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs">
                          {r.notebook_id ? `#${r.notebook_id}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs">
                          {r.lang || 'it'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
