import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkdownView from '../../components/MarkdownView'
import {
  fetchTopicArtifacts,
  fetchArtifact,
  updateArtifact,
  publishArtifact,
  archiveArtifact,
  generateArtifact,
  fetchTopicResources,
} from '../../lib/adminBackendApi'

const LANGS = [
  { code: 'it', label: 'IT' },
  { code: 'de', label: 'DE' },
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
]

const ARTIFACT_TYPES = [
  { key: 'study_guide', label: 'Guida di studio', icon: 'menu_book' },
  { key: 'flashcards', label: 'Flashcard', icon: 'style' },
  { key: 'quiz', label: 'Quiz', icon: 'quiz' },
]

function StatusBadge({ status }) {
  const map = {
    draft: 'bg-surface-container-high text-on-surface-variant',
    published: 'bg-green-100 text-green-700',
    archived: 'bg-outline/20 text-outline',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${map[status] || map.draft}`}>
      {status === 'draft' ? 'Bozza' : status === 'published' ? 'Pubblicato' : 'Archiviato'}
    </span>
  )
}

export default function TopicDetail() {
  const { area_id, topic_id } = useParams()
  const [artifacts, setArtifacts] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Detail drawer
  const [selectedArtifact, setSelectedArtifact] = useState(null)
  const [editingMd, setEditingMd] = useState('')
  const [saving, setSaving] = useState(false)
  const [detailMsg, setDetailMsg] = useState(null)
  const [viewMode, setViewMode] = useState('edit') // 'edit' | 'preview'

  // Generate form
  const [showGenerate, setShowGenerate] = useState(false)
  const [genForm, setGenForm] = useState({ type: 'study_guide', lang: 'it', instructions: '', resource_ids: [] })
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState(null)

  function loadArtifacts() {
    setLoading(true)
    setError(null)
    fetchTopicArtifacts(topic_id)
      .then(data => {
        setArtifacts(data || [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  function loadResources() {
    fetchTopicResources(topic_id)
      .then(data => setResources(data || []))
      .catch(() => {})
  }

  useEffect(() => {
    loadArtifacts()
    loadResources()
  }, [topic_id])

  function handleSelectArtifact(artifact) {
    setSelectedArtifact(artifact)
    setEditingMd(artifact.content?.text || artifact.content_md || '')
    setViewMode('edit')
    setDetailMsg(null)
  }

  async function handleSaveArtifact() {
    if (!selectedArtifact) return
    setSaving(true)
    setDetailMsg(null)
    try {
      const updated = await updateArtifact(selectedArtifact.id, { content: { text: editingMd } })
      setSelectedArtifact(updated)
      setArtifacts(prev => prev.map(a => a.id === updated.id ? updated : a))
      setDetailMsg({ type: 'success', text: 'Salvato.' })
    } catch (e) {
      setDetailMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!selectedArtifact || !confirm('Pubblicare questo artifact?')) return
    setSaving(true)
    setDetailMsg(null)
    try {
      const updated = await publishArtifact(selectedArtifact.id)
      setSelectedArtifact(updated)
      setArtifacts(prev => prev.map(a => a.id === updated.id ? updated : a))
      setDetailMsg({ type: 'success', text: 'Pubblicato.' })
    } catch (e) {
      setDetailMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!selectedArtifact || !confirm('Archiviare questo artifact?')) return
    setSaving(true)
    setDetailMsg(null)
    try {
      const updated = await archiveArtifact(selectedArtifact.id)
      setSelectedArtifact(updated)
      setArtifacts(prev => prev.map(a => a.id === updated.id ? updated : a))
      setDetailMsg({ type: 'success', text: 'Archiviato.' })
    } catch (e) {
      setDetailMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenMsg(null)
    try {
      await generateArtifact(topic_id, {
        type: genForm.type,
        lang: genForm.lang,
        instructions: genForm.instructions || undefined,
        resource_ids: genForm.resource_ids.length > 0 ? genForm.resource_ids : undefined,
      })
      setGenMsg({ type: 'success', text: 'Generazione avviata. Aggiorna la lista per vedere il nuovo artifact.' })
      setShowGenerate(false)
      loadArtifacts()
    } catch (e) {
      setGenMsg({ type: 'error', text: e.message })
    } finally {
      setGenerating(false)
    }
  }

  function toggleResource(id) {
    setGenForm(prev => ({
      ...prev,
      resource_ids: prev.resource_ids.includes(id)
        ? prev.resource_ids.filter(rid => rid !== id)
        : [...prev.resource_ids, id],
    }))
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 text-sm text-outline">Caricamento...</div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6 text-error text-sm">{error}</div>
      </AdminLayout>
    )
  }

  const artifactByType = Object.fromEntries(artifacts.map(a => [a.type, a]))

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <Link to={`/admin/areas/${area_id}`} className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Torna al ruolo
        </Link>

        <h2 className="font-headline font-bold text-2xl text-on-surface mb-6">Topic #{topic_id} — Artifact</h2>

        {/* Artifacts grid */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface">
              Artifact ({artifacts.length})
            </h3>
            <button
              onClick={() => { setShowGenerate(!showGenerate); setGenMsg(null) }}
              className="btn-primary text-sm"
            >
              {showGenerate ? 'Chiudi' : '+ Genera'}
            </button>
          </div>

          {/* Generate form */}
          {showGenerate && (
            <div className="card mb-4">
              <h4 className="font-bold text-on-surface mb-3">Genera artifact</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-outline uppercase mb-1 block">Tipo</label>
                  <select
                    className="input text-sm w-full"
                    value={genForm.type}
                    onChange={e => setGenForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    {ARTIFACT_TYPES.map(t => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-outline uppercase mb-1 block">Lingua</label>
                  <select
                    className="input text-sm w-full"
                    value={genForm.lang}
                    onChange={e => setGenForm(prev => ({ ...prev, lang: e.target.value }))}
                  >
                    {LANGS.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-outline uppercase mb-1 block">Istruzioni (opzionale)</label>
                  <input
                    className="input text-sm w-full"
                    placeholder="Prompt extra..."
                    value={genForm.instructions}
                    onChange={e => setGenForm(prev => ({ ...prev, instructions: e.target.value }))}
                  />
                </div>
              </div>

              {/* Resource selection */}
              {resources.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs text-outline uppercase mb-1 block">
                    Risorse ({resources.length} disponibili)
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-outline-variant/20 rounded-lg p-2">
                    {resources.map(r => (
                      <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-container-low rounded px-1 py-0.5">
                        <input
                          type="checkbox"
                          checked={genForm.resource_ids.includes(r.id)}
                          onChange={() => toggleResource(r.id)}
                          className="rounded"
                        />
                        <span className="text-on-surface">{r.title || r.name || `Risorsa #${r.id}`}</span>
                        <span className="text-[10px] text-outline ml-auto">{r.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {genMsg && (
                <div className={`mb-3 px-3 py-2 rounded text-sm ${genMsg.type === 'error' ? 'bg-error-container text-error' : 'bg-green-100 text-green-800'}`}>
                  {genMsg.text}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary text-sm"
              >
                {generating ? 'Generazione in corso...' : 'Genera'}
              </button>
            </div>
          )}

          {artifacts.length === 0 ? (
            <p className="text-sm text-outline">Nessun artifact. Clicca "+ Genera" per crearne uno.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {artifacts.map(a => (
                <button
                  key={a.id}
                  onClick={() => handleSelectArtifact(a)}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow ${
                    selectedArtifact?.id === a.id
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/20 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-lg">
                      {ARTIFACT_TYPES.find(t => t.key === a.type)?.icon || 'description'}
                    </span>
                    <span className="font-semibold text-on-surface text-sm">
                      {ARTIFACT_TYPES.find(t => t.key === a.type)?.label || a.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <StatusBadge status={a.status || 'draft'} />
                    <span>{a.lang || 'it'}</span>
                  </div>
                  {a.updated_at && (
                    <p className="text-[10px] text-outline mt-1">
                      {new Date(a.updated_at).toLocaleString()}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Artifact detail drawer */}
        {selectedArtifact && (
          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-on-surface">
                  {ARTIFACT_TYPES.find(t => t.key === selectedArtifact.type)?.label || selectedArtifact.type}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selectedArtifact.status || 'draft'} />
                  <span className="text-xs text-on-surface-variant">{selectedArtifact.lang || 'it'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'edit' ? (
                  <button
                    onClick={() => setViewMode('preview')}
                    className="btn-secondary text-sm"
                  >
                    Anteprima studente
                  </button>
                ) : (
                  <button
                    onClick={() => setViewMode('edit')}
                    className="btn-secondary text-sm"
                  >
                    Modifica
                  </button>
                )}
                <button onClick={handleSaveArtifact} disabled={saving} className="btn-primary text-sm">
                  {saving ? '...' : 'Salva'}
                </button>
                {selectedArtifact.status !== 'published' && (
                  <button onClick={handlePublish} disabled={saving} className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-semibold hover:bg-green-200">
                    Pubblica
                  </button>
                )}
                {selectedArtifact.status !== 'archived' && (
                  <button onClick={handleArchive} disabled={saving} className="px-3 py-2 rounded-lg bg-outline/10 text-outline text-sm hover:bg-outline/20">
                    Archivia
                  </button>
                )}
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="material-symbols-outlined text-outline hover:text-on-surface"
                >
                  close
                </button>
              </div>
            </div>

            {detailMsg && (
              <div className={`mb-3 px-3 py-2 rounded text-sm ${detailMsg.type === 'error' ? 'bg-error-container text-error' : 'bg-green-100 text-green-800'}`}>
                {detailMsg.text}
              </div>
            )}

            {viewMode === 'edit' ? (
              <textarea
                value={editingMd}
                onChange={e => setEditingMd(e.target.value)}
                className="w-full h-80 p-4 bg-surface-container-lowest rounded-lg font-mono text-sm resize-none"
                placeholder="Contenuto markdown..."
              />
            ) : (
              <div className="w-full h-80 p-4 bg-surface-container-lowest rounded-lg overflow-y-auto">
                <MarkdownView content={editingMd || '*Nessun contenuto*'} />
              </div>
            )}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
