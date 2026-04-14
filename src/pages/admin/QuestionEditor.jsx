import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllQuestions, createQuestion, updateQuestion, deleteQuestion } from '../../lib/adminApi'
import { AREAS } from '../../data/areas'

const EMPTY_MULTIPLE = { type: 'multiple', text: '', options: { A: '', B: '', C: '', D: '' }, correct: 'A', motivation: '', area: 4, topic: '', lang: 'it', status: 'draft' }
const EMPTY_TRUEFALSE = { type: 'truefalse', text: '', items: [{ text: '', correct: true }, { text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }], motivation: '', area: 4, topic: '', lang: 'it', status: 'draft' }

export default function AdminQuestionEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [form, setForm] = useState(EMPTY_MULTIPLE)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isNew) return
    getAllQuestions({ pageSize: 2000 }).then(({ data: qs }) => {
      const q = qs.find(x => x.id === id)
      if (q) setForm(q)
      setLoading(false)
    })
  }, [id])

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function setOption(key, val) {
    setForm(prev => ({ ...prev, options: { ...prev.options, [key]: val } }))
  }

  function setItem(i, key, val) {
    setForm(prev => {
      const items = [...prev.items]
      items[i] = { ...items[i], [key]: val }
      return { ...prev, items }
    })
  }

  function switchType(type) {
    if (type === 'multiple') setForm(prev => ({ ...EMPTY_MULTIPLE, text: prev.text, area: prev.area, topic: prev.topic, lang: prev.lang, status: prev.status }))
    else setForm(prev => ({ ...EMPTY_TRUEFALSE, text: prev.text, area: prev.area, topic: prev.topic, lang: prev.lang, status: prev.status }))
  }

  async function handleSave(status) {
    setSaving(true)
    setError(null)
    try {
      const data = { ...form, status: status || form.status }
      if (isNew) {
        await createQuestion(data)
      } else {
        await updateQuestion(id, data)
      }
      navigate('/admin/questions')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Eliminare questa domanda?')) return
    await deleteQuestion(id)
    navigate('/admin/questions')
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin/questions')} className="p-2 hover:bg-surface-container-high rounded-lg">
            <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-headline font-bold text-2xl text-on-surface">{isNew ? 'Nuova domanda' : 'Modifica domanda'}</h2>
        </div>

        <div className="space-y-5">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-2">Tipo</label>
            <div className="flex gap-3">
              {['multiple', 'truefalse'].map(t => (
                <button
                  key={t}
                  onClick={() => switchType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${form.type === t ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/20 text-secondary hover:border-outline-variant/30'}`}
                >
                  {t === 'multiple' ? 'Multipla scelta' : 'K-PRIM (V/F)'}
                </button>
              ))}
            </div>
          </div>

          {/* Testo */}
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">Testo domanda</label>
            <textarea
              value={form.text}
              onChange={e => setField('text', e.target.value)}
              rows={3}
              className="input w-full"
              placeholder="Inserisci il testo della domanda..."
            />
          </div>

          {/* Opzioni multipla scelta */}
          {form.type === 'multiple' && (
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-2">Opzioni</label>
              <div className="space-y-2">
                {['A', 'B', 'C', 'D'].map(letter => (
                  <div key={letter} className="flex items-center gap-2">
                    <button
                      onClick={() => setField('correct', letter)}
                      className={`w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 border-2 ${form.correct === letter ? 'border-green-500 bg-green-500 text-white' : 'border-outline-variant text-secondary'}`}
                    >
                      {letter}
                    </button>
                    <input
                      type="text"
                      value={form.options[letter] || ''}
                      onChange={e => setOption(letter, e.target.value)}
                      className="input flex-1"
                      placeholder={`Opzione ${letter}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-outline mt-1">Clicca sulla lettera per impostarla come risposta corretta</p>
            </div>
          )}

          {/* K-PRIM items */}
          {form.type === 'truefalse' && (
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-2">Affermazioni (V/F)</label>
              <div className="space-y-2">
                {(form.items || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 text-sm font-bold text-outline flex-shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={item.text || ''}
                      onChange={e => setItem(i, 'text', e.target.value)}
                      className="input flex-1"
                      placeholder={`Affermazione ${i + 1}`}
                    />
                    <button
                      onClick={() => setItem(i, 'correct', !item.correct)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${item.correct ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-600'}`}
                    >
                      {item.correct ? 'V' : 'F'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Motivazione */}
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">Motivazione / Spiegazione</label>
            <textarea
              value={form.motivation || ''}
              onChange={e => setField('motivation', e.target.value)}
              rows={3}
              className="input w-full"
              placeholder="Spiega la risposta corretta..."
            />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Area</label>
              <select value={form.area} onChange={e => setField('area', Number(e.target.value))} className="input w-full">
                {Object.entries(AREAS).map(([k, v]) => (
                  <option key={k} value={k}>R{k} – {v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Lingua</label>
              <select value={form.lang} onChange={e => setField('lang', e.target.value)} className="input w-full">
                <option value="it">Italiano</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Argomento</label>
              <input type="text" value={form.topic || ''} onChange={e => setField('topic', e.target.value)} className="input w-full" placeholder="es. Anticoagulanti" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Stato</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)} className="input w-full">
                <option value="draft">Bozza</option>
                <option value="active">Attiva</option>
                <option value="archived">Archiviata</option>
              </select>
            </div>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary">
              Salva bozza
            </button>
            <button onClick={() => handleSave('active')} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Salvataggio...' : 'Salva e attiva'}
            </button>
            {!isNew && (
              <button onClick={handleDelete} className="px-4 py-2 text-error hover:text-error/80 text-sm font-semibold">
                Elimina
              </button>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
