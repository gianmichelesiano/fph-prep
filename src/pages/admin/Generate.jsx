import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { createQuestion, updateQuestion, deleteQuestion } from '../../lib/adminApi'
import { supabase } from '../../lib/supabase'
import { AREAS } from '../../data/areas'

// Formato AI (edge function) → formato DB questions.
// multiple → multiple_choice (options A..D, correct_answer = lettera)
// truefalse → kprim (options 1..4, correct_answer = "VFVF")
function aiToDb(q, area, lang) {
  const base = {
    text: q.text,
    explanation: q.motivation || null,
    area,
    lang,
    status: 'draft',
    expert_approved: false,
  }
  if (q.type === 'truefalse' && Array.isArray(q.items)) {
    return {
      ...base,
      type: 'kprim',
      options: Object.fromEntries(q.items.map((it, i) => [String(i + 1), it.text])),
      correct_answer: q.items.map(it => (it.correct ? 'V' : 'F')).join(''),
    }
  }
  return {
    ...base,
    type: 'multiple_choice',
    options: q.options || {},
    correct_answer: q.correct || 'A',
  }
}

export default function AdminGenerate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ area: 4, lang: 'it', count: 5 })
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState([]) // righe DB (status=draft) salvate
  const [error, setError] = useState(null)
  const [rowErrors, setRowErrors] = useState({})
  const [busy, setBusy] = useState({})
  const [published, setPublished] = useState({})

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setDrafts([])
    setPublished({})
    setRowErrors({})
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-questions', {
        body: { area: form.area, lang: form.lang, count: form.count },
      })
      if (fnError) throw fnError
      if (!data?.questions?.length) throw new Error('Nessuna domanda generata')

      // Salva subito tutte come bozze: niente va perso se chiudi la pagina.
      const savedRows = []
      const saveErrors = []
      for (const q of data.questions) {
        try {
          savedRows.push(await createQuestion(aiToDb(q, form.area, form.lang)))
        } catch (e) {
          saveErrors.push(e.message)
        }
      }
      setDrafts(savedRows)
      if (saveErrors.length) {
        setError(`${saveErrors.length} domande non salvate: ${saveErrors[0]}`)
      }
    } catch (err) {
      setError(err.message || 'Errore durante la generazione')
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish(q) {
    setBusy(prev => ({ ...prev, [q.id]: true }))
    setRowErrors(prev => ({ ...prev, [q.id]: null }))
    try {
      await updateQuestion(q.id, { status: 'active' })
      setPublished(prev => ({ ...prev, [q.id]: true }))
    } catch (e) {
      setRowErrors(prev => ({ ...prev, [q.id]: e.message }))
    } finally {
      setBusy(prev => ({ ...prev, [q.id]: false }))
    }
  }

  async function handlePublishAll() {
    for (const q of drafts) {
      if (!published[q.id]) await handlePublish(q)
    }
  }

  async function handleDiscard(q) {
    setBusy(prev => ({ ...prev, [q.id]: true }))
    try {
      await deleteQuestion(q.id)
      setDrafts(prev => prev.filter(d => d.id !== q.id))
    } catch (e) {
      setRowErrors(prev => ({ ...prev, [q.id]: e.message }))
      setBusy(prev => ({ ...prev, [q.id]: false }))
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h2 className="font-headline font-bold text-2xl text-on-surface">Genera domande con AI</h2>
          <p className="text-sm text-secondary">
            Le domande generate vengono salvate come bozze: pubblicale dopo la revisione
          </p>
        </div>

        {/* Form */}
        <div className="card mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Ruolo</label>
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

        {/* Bozze salvate */}
        {drafts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-on-surface">
                {drafts.length} bozze salvate
                <span className="text-xs font-normal text-secondary ml-2">
                  (le trovi anche in Domande → Bozze)
                </span>
              </h3>
              <button onClick={handlePublishAll} className="text-sm text-primary hover:text-primary/80 font-semibold">
                Pubblica tutte
              </button>
            </div>
            <div className="space-y-4">
              {drafts.map(q => (
                <div key={q.id} className={`card border-2 ${published[q.id] ? 'border-green-300 bg-green-50' : 'border-outline-variant/20'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-sm font-semibold text-on-surface flex-1 leading-snug">{q.text}</p>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex-shrink-0">
                      {q.type === 'multiple_choice' ? 'Multipla' : 'K-PRIM'}
                    </span>
                  </div>

                  {q.type === 'multiple_choice' && q.options && (
                    <div className="space-y-1 mb-3">
                      {Object.entries(q.options).map(([k, v]) => (
                        <div key={k} className={`text-xs px-3 py-1.5 rounded-lg ${q.correct_answer === k ? 'bg-green-100 text-green-800 font-semibold' : 'bg-surface-container-low text-on-surface-variant'}`}>
                          <span className="font-bold mr-2">{k}.</span>{v}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'kprim' && q.options && (
                    <div className="space-y-1 mb-3">
                      {Object.entries(q.options).map(([k, v], i) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded font-bold ${q.correct_answer?.[i] === 'V' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {q.correct_answer?.[i] === 'V' ? 'V' : 'F'}
                          </span>
                          <span className="text-on-surface-variant">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.explanation && (
                    <p className="text-xs text-secondary italic mb-3 bg-primary/5 rounded-lg p-2">{q.explanation}</p>
                  )}

                  {rowErrors[q.id] && (
                    <p className="text-error text-xs mb-2">{rowErrors[q.id]}</p>
                  )}

                  {published[q.id] ? (
                    <p className="text-primary text-sm font-semibold">✓ Pubblicata</p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePublish(q)}
                        disabled={busy[q.id]}
                        className="btn-primary text-sm py-1.5 flex-1"
                      >
                        {busy[q.id] ? 'Pubblicazione...' : 'Pubblica'}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/questions/${q.id}`)}
                        className="btn-secondary text-sm py-1.5"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDiscard(q)}
                        disabled={busy[q.id]}
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
