import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { createQuestion } from '../../lib/adminApi'
import { supabase } from '../../lib/supabase'
import { AREAS } from '../../data/areas'

export default function AdminGenerate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ area: 4, lang: 'it', count: 5 })
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setGenerated([])
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-questions', {
        body: { area: form.area, lang: form.lang, count: form.count },
      })
      if (fnError) throw fnError
      if (!data?.questions?.length) throw new Error('Nessuna domanda generata')
      setGenerated(data.questions.map((q, i) => ({ ...q, _id: i, status: 'draft' })))
    } catch (err) {
      setError(err.message || 'Errore durante la generazione')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove(q) {
    setSaving(prev => ({ ...prev, [q._id]: true }))
    try {
      await createQuestion({ ...q, status: 'active', area: form.area, lang: form.lang })
      setSaved(prev => ({ ...prev, [q._id]: true }))
    } catch {
      // ignore
    } finally {
      setSaving(prev => ({ ...prev, [q._id]: false }))
    }
  }

  async function handleApproveAll() {
    for (const q of generated) {
      if (!saved[q._id]) await handleApprove(q)
    }
  }

  function handleDiscard(id) {
    setGenerated(prev => prev.filter(q => q._id !== id))
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h2 className="font-headline font-bold text-2xl text-on-surface">Genera domande con AI</h2>
          <p className="text-sm text-secondary">Claude genera domande in stile FPH per l'area selezionata</p>
        </div>

        {/* Form */}
        <div className="card mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
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
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Numero</label>
              <select value={form.count} onChange={e => setField('count', Number(e.target.value))} className="input w-full">
                {[3, 5, 10, 15, 20].map(n => (
                  <option key={n} value={n}>{n} domande</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-error text-sm mb-3">{error}</p>}
          <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full">
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Generazione in corso...
              </span>
            ) : 'Genera domande'}
          </button>
        </div>

        {/* Generated questions */}
        {generated.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-on-surface">{generated.length} domande generate</h3>
              <button onClick={handleApproveAll} className="text-sm text-primary hover:text-primary/80 font-semibold">
                Approva tutte
              </button>
            </div>
            <div className="space-y-4">
              {generated.map(q => (
                <div key={q._id} className={`card border-2 ${saved[q._id] ? 'border-green-300 bg-green-50' : 'border-outline-variant/20'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-sm font-semibold text-on-surface flex-1 leading-snug">{q.text}</p>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex-shrink-0">
                      {q.type === 'multiple' ? 'Multipla' : 'K-PRIM'}
                    </span>
                  </div>

                  {q.type === 'multiple' && q.options && (
                    <div className="space-y-1 mb-3">
                      {Object.entries(q.options).map(([k, v]) => (
                        <div key={k} className={`text-xs px-3 py-1.5 rounded-lg ${q.correct === k ? 'bg-green-100 text-green-800 font-semibold' : 'bg-surface-container-low text-on-surface-variant'}`}>
                          <span className="font-bold mr-2">{k}.</span>{v}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'truefalse' && q.items && (
                    <div className="space-y-1 mb-3">
                      {q.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded font-bold ${item.correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {item.correct ? 'V' : 'F'}
                          </span>
                          <span className="text-on-surface-variant">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.motivation && (
                    <p className="text-xs text-secondary italic mb-3 bg-primary/5 rounded-lg p-2">{q.motivation}</p>
                  )}

                  {saved[q._id] ? (
                    <p className="text-primary text-sm font-semibold">✓ Salvata nel database</p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(q)}
                        disabled={saving[q._id]}
                        className="btn-primary text-sm py-1.5 flex-1"
                      >
                        {saving[q._id] ? 'Salvataggio...' : 'Approva'}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/questions/new`, { state: { prefill: q } })}
                        className="btn-secondary text-sm py-1.5"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDiscard(q._id)}
                        className="px-3 py-1.5 text-error hover:text-error/80 text-sm"
                      >
                        Scarta
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
