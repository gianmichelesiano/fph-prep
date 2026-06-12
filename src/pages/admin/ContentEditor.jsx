import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkdownView from '../../components/MarkdownView'
import {
  fetchContentForEdit,
  upsertContent,
  uploadSummaryImage,
} from '../../lib/notebookContentsApi'
import { translateText } from '../../lib/adminBackendApi'

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
      </div>
    </AdminLayout>
  )
}
