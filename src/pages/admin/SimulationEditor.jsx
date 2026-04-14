import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import {
  getAllSimulations, createSimulation, updateSimulation, deleteSimulation,
  getAllQuestions, addQuestionToSimulation, removeQuestionFromSimulation,
  reorderSimulationQuestions
} from '../../lib/adminApi'
import { fetchSimulation } from '../../lib/api'
import { AREAS } from '../../data/areas'

const EMPTY = { title: '', area: 4, timer: 90, lang: 'it', is_free: false }

export default function AdminSimulationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [form, setForm] = useState(EMPTY)
  const [questions, setQuestions] = useState([]) // questions in this simulation
  const [allQuestions, setAllQuestions] = useState([]) // pool
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isNew) {
      fetchSimulation(id)
        .then(data => {
          setForm({ title: data.title, area: data.area, timer: data.timer, lang: data.lang, is_free: data.is_free })
          setQuestions(data.questions || [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
    getAllQuestions({ pageSize: 2000 }).then(({ data }) => setAllQuestions(data))
  }, [id])

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const sim = await createSimulation(form)
        navigate(`/admin/simulations/${sim.id}`)
      } else {
        await updateSimulation(id, form)
        navigate('/admin/simulations')
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Eliminare questa simulazione?')) return
    await deleteSimulation(id)
    navigate('/admin/simulations')
  }

  async function handleAddQuestion(qId) {
    if (questions.find(q => q.id === qId)) return
    const q = allQuestions.find(x => x.id === qId)
    if (!q) return
    await addQuestionToSimulation(id, qId, questions.length)
    setQuestions(prev => [...prev, q])
    setShowPicker(false)
  }

  async function handleRemoveQuestion(qId) {
    await removeQuestionFromSimulation(id, qId)
    setQuestions(prev => prev.filter(q => q.id !== qId))
  }

  const pickerFiltered = allQuestions.filter(q =>
    !questions.find(x => x.id === q.id) &&
    (!pickerSearch || q.text.toLowerCase().includes(pickerSearch.toLowerCase()))
  )

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
          <button onClick={() => navigate('/admin/simulations')} className="p-2 hover:bg-surface-container-high rounded-lg">
            <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-headline font-bold text-2xl text-on-surface">{isNew ? 'Nuova simulazione' : 'Modifica simulazione'}</h2>
        </div>

        <div className="space-y-5">
          {/* Basic info */}
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">Titolo</label>
            <input type="text" value={form.title} onChange={e => setField('title', e.target.value)} className="input w-full" placeholder="es. Simulazione Area 4 – Farmacia Clinica" />
          </div>

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
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Timer (minuti)</label>
              <input type="number" value={form.timer || ''} onChange={e => setField('timer', Number(e.target.value) || null)} className="input w-full" placeholder="es. 90" min="0" />
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
            <div className="flex items-center gap-3 mt-6">
              <input
                type="checkbox"
                id="is_free"
                checked={form.is_free}
                onChange={e => setField('is_free', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="is_free" className="text-sm font-semibold text-on-surface-variant">Accesso gratuito</label>
            </div>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
            {!isNew && (
              <button onClick={handleDelete} className="px-4 py-2 text-error hover:text-error/80 text-sm font-semibold">
                Elimina
              </button>
            )}
          </div>

          {/* Questions (only for existing simulations) */}
          {!isNew && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-on-surface">Domande ({questions.length})</h3>
                <button onClick={() => setShowPicker(true)} className="text-sm text-primary hover:text-primary/80 font-semibold">
                  + Aggiungi
                </button>
              </div>

              {questions.length === 0 ? (
                <p className="text-sm text-outline">Nessuna domanda aggiunta</p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={q.id} className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl">
                      <span className="text-xs font-bold text-outline mt-0.5 w-5 flex-shrink-0">{i + 1}</span>
                      <p className="text-sm text-on-surface flex-1 leading-snug">{q.text}</p>
                      <button
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="text-error hover:text-error/80 text-xs flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Question picker modal */}
              {showPicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between">
                      <h3 className="font-bold text-on-surface">Aggiungi domanda</h3>
                      <button onClick={() => setShowPicker(false)} className="text-outline hover:text-on-surface-variant">✕</button>
                    </div>
                    <div className="p-4 border-b">
                      <input
                        type="text"
                        placeholder="Cerca domanda..."
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        className="input w-full"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {pickerFiltered.slice(0, 50).map(q => (
                        <button
                          key={q.id}
                          onClick={() => handleAddQuestion(q.id)}
                          className="w-full text-left p-3 hover:bg-primary/5 rounded-xl text-sm text-on-surface"
                        >
                          <p className="leading-snug">{q.text}</p>
                          <p className="text-xs text-outline mt-0.5">R{q.area} · {q.type}</p>
                        </button>
                      ))}
                      {pickerFiltered.length === 0 && <p className="text-center text-outline py-6">Nessuna domanda trovata</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
