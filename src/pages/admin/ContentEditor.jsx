import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkdownView from '../../components/MarkdownView'
import {
  fetchContentForEdit,
  upsertContent,
  uploadSummaryImage,
} from '../../lib/notebookContentsApi'

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
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetchContentForEdit(notebook_id, 'it')
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
  }, [notebook_id])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await upsertContent({
        notebook_id,
        lang: 'it',
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

        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
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
