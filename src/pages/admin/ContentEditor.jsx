import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkdownView from '../../components/MarkdownView'
import {
  fetchContentForEdit,
  upsertContent,
  uploadSummaryImage,
} from '../../lib/notebookContentsApi'
import { translateText, generateStudyPath, fetchStudyPathJobs, fetchStudyPath } from '../../lib/adminBackendApi'

const LANGS = [
  { code: 'it', label: 'IT', native: 'Italiano' },
  { code: 'de', label: 'DE', native: 'Deutsch' },
  { code: 'fr', label: 'FR', native: 'Français' },
  { code: 'en', label: 'EN', native: 'English' },
]

export default function ContentEditor() {
  const { notebook_id } = useParams()
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const [notebook, setNotebook] = useState(null)
  const [md, setMd] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [lang, setLang] = useState('it')

  // Study path
  const [studyPath, setStudyPath] = useState(null)
  const [spJobs, setSpJobs] = useState([])
  const [spPolling, setSpPolling] = useState(null) // interval ID
  const [spGenerating, setSpGenerating] = useState(false)
  const [spMsg, setSpMsg] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetchContentForEdit(notebook_id, lang)
      .then(({ notebook, content }) => {
        setNotebook(notebook)
        setMd(content.content_md || '')
        setIsFree(content.is_free || false)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setMsg({ type: 'error', text: err.message })
        setLoading(false)
      })
  }, [notebook_id, lang])

  // Load study path and recent jobs on mount
  useEffect(() => {
    if (!notebook_id) return
    fetchStudyPath(notebook_id).then(setStudyPath).catch(() => setStudyPath(null))
    fetchStudyPathJobs(notebook_id).then(data => setSpJobs(data || [])).catch(() => {})
  }, [notebook_id])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (spPolling) clearInterval(spPolling)
    }
  }, [spPolling])

  async function handleGenerateStudyPath() {
    setSpGenerating(true)
    setSpMsg(null)
    try {
      await generateStudyPath(notebook_id)
      setSpMsg({ type: 'success', text: 'Generazione avviata. In attesa del completamento...' })
      // Start polling
      const interval = setInterval(async () => {
        try {
          const jobs = await fetchStudyPathJobs(notebook_id)
          setSpJobs(jobs || [])
          const running = (jobs || []).some(j => j.status === 'pending' || j.status === 'running')
          if (!running) {
            clearInterval(interval)
            setSpPolling(null)
            // Reload study path
            const sp = await fetchStudyPath(notebook_id).catch(() => null)
            setStudyPath(sp)
            setSpMsg(sp ? { type: 'success', text: 'Study path generato!' } : { type: 'error', text: 'Generazione completata ma nessun risultato.' })
          }
        } catch { /* polling error, retry next tick */ }
      }, 5000)
      setSpPolling(interval)
      // Max 5 min timeout
      setTimeout(() => {
        clearInterval(interval)
        if (spPolling === interval) setSpPolling(null)
      }, 5 * 60 * 1000)
    } catch (e) {
      setSpMsg({ type: 'error', text: e.message })
    } finally {
      setSpGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await upsertContent({
        notebook_id,
        lang,
        content_md: md,
        is_free: isFree,
      })
      setMsg({ type: 'success', text: 'Salvato.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleTranslateFromIT() {
    setTranslating(true)
    setMsg(null)
    try {
      // Fetch IT content
      const { content: itContent } = await fetchContentForEdit(notebook_id, 'it')
      if (!itContent?.content_md) {
        setMsg({ type: 'error', text: 'Nessun contenuto italiano da tradurre.' })
        setTranslating(false)
        return
      }

      // Call translation endpoint via admin backend client
      const data = await translateText(itContent.content_md, 'it', lang)
      setMd(data.translated_text)
      setMsg({ type: 'success', text: `Tradotto da IT a ${lang.toUpperCase()}. Rivedi e salva.` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setTranslating(false)
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !notebook) return
    setUploading(true)
    setMsg(null)
    try {
      const url = await uploadSummaryImage(notebook.key, file)
      const insert = `\n![${file.name}](${url})\n`
      const ta = textareaRef.current
      if (ta) {
        const pos = ta.selectionStart
        const next = md.slice(0, pos) + insert + md.slice(pos)
        setMd(next)
      } else {
        setMd(md + insert)
      }
      setMsg({ type: 'success', text: 'Immagine caricata.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">Caricamento...</div>
      </AdminLayout>
    )
  }

  if (!notebook) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p>Notebook non trovato.</p>
          <Link to="/admin/contents" className="text-primary underline">← Torna alla lista</Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Link to="/admin/contents" className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Contents
        </Link>

        <header className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h1 className="font-headline font-bold text-2xl text-on-surface">{notebook.title}</h1>
              <p className="text-xs text-on-surface-variant font-mono mt-1">{notebook.key} · Area {notebook.area_id}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={e => setIsFree(e.target.checked)}
                />
                is_free
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2 rounded-lg bg-surface-container text-sm hover:bg-surface-container-high disabled:opacity-50"
              >
                {uploading ? 'Upload...' : '📎 Immagine'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>

          {/* Language selector + Translate */}
          <div className="flex items-center gap-3 flex-wrap">
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
            {lang !== 'it' && (
              <button
                onClick={handleTranslateFromIT}
                disabled={translating}
                className="px-3 py-1.5 rounded-lg bg-tertiary/10 text-tertiary text-xs font-semibold hover:bg-tertiary/20 disabled:opacity-50 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">translate</span>
                {translating ? 'Traduzione...' : 'Traduci da IT'}
              </button>
            )}
          </div>
        </header>

        {msg && (
          <div className={`mb-4 px-3 py-2 rounded text-sm ${msg.type === 'error' ? 'bg-error-container text-error' : 'bg-tertiary/10 text-tertiary'}`}>
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-on-surface-variant uppercase tracking-wider">Markdown</label>
            <textarea
              ref={textareaRef}
              value={md}
              onChange={e => setMd(e.target.value)}
              spellCheck={false}
              className="mt-1 w-full h-[70vh] p-4 bg-surface-container-lowest rounded-lg font-mono text-sm resize-none"
              placeholder="# Titolo\n\nContenuto markdown..."
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant uppercase tracking-wider">Anteprima</label>
            <div className="mt-1 w-full h-[70vh] p-4 bg-surface-container-lowest rounded-lg overflow-y-auto">
              <MarkdownView content={md} />
            </div>
          </div>
        </div>

        {/* Study Path section */}
        <section className="mt-8 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface">Study Path</h3>
            <button
              onClick={handleGenerateStudyPath}
              disabled={spGenerating || !!spPolling}
              className="btn-primary text-sm"
            >
              {spGenerating ? 'Avvio...' : spPolling ? 'In corso...' : 'Genera study path'}
            </button>
          </div>

          {spMsg && (
            <div className={`mb-3 px-3 py-2 rounded text-sm ${spMsg.type === 'error' ? 'bg-error-container text-error' : 'bg-green-100 text-green-800'}`}>
              {spMsg.text}
            </div>
          )}

          {/* Polling indicator */}
          {spPolling && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <span className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-primary font-medium">Generazione in corso...</span>
            </div>
          )}

          {/* Current study path */}
          {studyPath ? (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-on-surface mb-2">Stato attuale</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {['study_guide', 'flashcards', 'quiz'].map(type => {
                  const sections = studyPath.sections || studyPath.content?.sections || {}
                  const data = sections[type]
                  const hasContent = data && (data.content || data.cards || data.questions)
                  return (
                    <div key={type} className={`p-3 rounded-lg border ${hasContent ? 'border-green-200 bg-green-50/20' : 'border-outline-variant/20 bg-surface-container-lowest'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">
                          {type === 'study_guide' ? 'menu_book' : type === 'flashcards' ? 'style' : 'quiz'}
                        </span>
                        <span className="text-xs font-semibold text-on-surface">
                          {type === 'study_guide' ? 'Guida' : type === 'flashcards' ? 'Flashcard' : 'Quiz'}
                        </span>
                      </div>
                      {hasContent ? (
                        <span className="text-[10px] text-green-700 font-medium">
                          {type === 'flashcards' ? `${(data.cards || data.questions || []).length} carte` :
                           type === 'quiz' ? `${(data.questions || []).length} domande` :
                           'Disponibile'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-outline">Non generato</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Preview study guide content */}
              {studyPath.sections?.study_guide?.content && (
                <details className="mt-3">
                  <summary className="text-sm text-primary cursor-pointer hover:underline">
                    Anteprima guida di studio
                  </summary>
                  <div className="mt-2 p-4 bg-surface-container-lowest rounded-lg max-h-64 overflow-y-auto">
                    <MarkdownView content={studyPath.sections.study_guide.content} />
                  </div>
                </details>
              )}
            </div>
          ) : (
            <p className="text-sm text-outline mb-4">Nessuno study path ancora generato per questo notebook.</p>
          )}

          {/* Recent jobs */}
          {spJobs.length > 0 && (
            <details>
              <summary className="text-sm text-on-surface-variant cursor-pointer hover:text-on-surface">
                Storico job ({spJobs.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {spJobs.map(j => (
                  <div key={j.id} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-surface-container-low">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      j.status === 'completed' ? 'bg-green-500' :
                      j.status === 'failed' ? 'bg-error' :
                      j.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-outline'
                    }`} />
                    <span className="text-on-surface-variant font-mono text-[10px]">
                      {j.created_at ? new Date(j.created_at).toLocaleString() : '—'}
                    </span>
                    <span className="text-on-surface">{j.status}</span>
                    {j.error && <span className="text-error truncate">{j.error}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
