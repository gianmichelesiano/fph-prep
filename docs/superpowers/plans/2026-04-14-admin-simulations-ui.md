# Admin Simulations UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare le pagine admin per le simulazioni con supporto a due tipi (exam/custom), configurazione area_config e visualizzazione sessioni avviate.

**Architecture:** `Simulations.jsx` diventa una lista con due sezioni (Exam / Custom). `SimulationEditor.jsx` viene riscritto con form differenziati per tipo: exam ha area_config fissa e timer 210, custom ha input per ogni area più timer libero.

**Tech Stack:** React, React Router v6, `@supabase/supabase-js`, Tailwind CSS design system esistente

---

### Task 1: Aggiornare src/data/areas.js

**Files:**
- Modify: `src/data/areas.js`

L'area 10 "Altro" esiste nel DB ma non nel file statico. Va aggiunta.

- [ ] **Step 1: Aggiungere area 10 ad AREAS**

Sostituire tutto il contenuto di `src/data/areas.js`:

```js
// FPH Offizin exam areas with design-system color tokens
// Source of truth: public.areas table in Supabase
// This static map is used as fallback until the DB is loaded
export const AREAS = {
  1:  { name: 'Validazione ricette',      color: 'bg-primary/10 text-primary',                              questions: 7  },
  2:  { name: 'Fitoterapia',              color: 'bg-tertiary/10 text-tertiary',                             questions: 3  },
  3:  { name: 'Medicina complementare',   color: 'bg-secondary/10 text-secondary',                           questions: 3  },
  4:  { name: 'Farmacia Clinica',         color: 'bg-primary-container/20 text-primary-container',           questions: 50 },
  5:  { name: 'Anamnesi e terapia',       color: 'bg-primary/10 text-primary',                               questions: 10 },
  6:  { name: 'Preparazione medicinali',  color: 'bg-tertiary/15 text-tertiary',                             questions: 7  },
  7:  { name: 'Risultati di laboratorio', color: 'bg-secondary-container text-on-secondary-container',       questions: 7  },
  8:  { name: "Situazioni d'emergenza",   color: 'bg-error-container text-error',                            questions: 7  },
  9:  { name: 'Vaccinazioni e prelievi',  color: 'bg-primary-fixed/30 text-on-primary-fixed',                questions: 7  },
  10: { name: 'Altro',                    color: 'bg-surface-container-high text-on-surface-variant',        questions: 3  },
}

// area_config fissa per simulazioni d'esame FPH
export const EXAM_AREA_CONFIG = { 1:7, 2:3, 3:3, 4:50, 5:10, 6:7, 7:3, 8:7, 9:7, 10:3 }
export const EXAM_TIMER = 210
export const EXAM_TOTAL = 100
```

- [ ] **Step 2: Commit**

```bash
git add src/data/areas.js
git commit -m "feat: add area 10 and EXAM_AREA_CONFIG constants to areas.js"
```

---

### Task 2: Riscrivere Simulations.jsx

**Files:**
- Modify: `src/pages/admin/Simulations.jsx`

Lista con due sezioni (Exam / Custom). Mostra sessionCount, tipo, totale domande, timer, stato accesso.

- [ ] **Step 1: Riscrivere il file**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllSimulations, deleteSimulation } from '../../lib/adminApi'

export default function AdminSimulations() {
  const navigate = useNavigate()
  const [simulations, setSimulations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllSimulations()
      .then(data => { setSimulations(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Eliminare questa simulazione? Tutte le sessioni collegate verranno eliminate.')) return
    await deleteSimulation(id)
    setSimulations(prev => prev.filter(s => s.id !== id))
  }

  const exam = simulations.filter(s => s.type === 'exam')
  const custom = simulations.filter(s => s.type === 'custom')

  function totalQuestions(sim) {
    const cfg = sim.area_config || {}
    return Object.values(cfg).reduce((sum, n) => sum + Number(n), 0)
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Simulazioni</h2>
            <p className="text-sm text-secondary">{simulations.length} template totali</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => navigate('/admin/simulations/new?type=exam')}
            >
              + Esame
            </button>
            <button
              className="btn-primary text-sm"
              onClick={() => navigate('/admin/simulations/new?type=custom')}
            >
              + Custom
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse h-14 bg-surface-container-high" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <Section
              title="Simulazioni d'Esame"
              subtitle="Schema fisso — 100 domande, 210 min"
              badge="exam"
              items={exam}
              totalQuestions={totalQuestions}
              onRowClick={id => navigate(`/admin/simulations/${id}`)}
              onDelete={handleDelete}
            />
            <Section
              title="Simulazioni Custom"
              subtitle="Struttura libera — area e tempo configurabili"
              badge="custom"
              items={custom}
              totalQuestions={totalQuestions}
              onRowClick={id => navigate(`/admin/simulations/${id}`)}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function Section({ title, subtitle, badge, items, totalQuestions, onRowClick, onDelete }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-headline font-semibold text-lg text-on-surface">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge === 'exam' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
          {items.length}
        </span>
        <p className="text-xs text-outline">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-outline py-4 px-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
          Nessun template
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-outline uppercase border-b border-outline-variant/20">
              <tr>
                <th className="text-left px-4 py-3">Titolo</th>
                <th className="text-left px-4 py-3 w-24">Domande</th>
                <th className="text-left px-4 py-3 w-24">Timer</th>
                <th className="text-left px-4 py-3 w-24">Sessioni</th>
                <th className="text-left px-4 py-3 w-20">Accesso</th>
                <th className="text-left px-4 py-3 w-20">Stato</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {items.map(sim => (
                <tr
                  key={sim.id}
                  className="hover:bg-surface-container cursor-pointer transition-colors"
                  onClick={() => onRowClick(sim.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-on-surface">{sim.title}</p>
                    <p className="text-xs text-outline">{sim.lang}</p>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{totalQuestions(sim)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{sim.timer ? `${sim.timer} min` : '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{sim.sessionCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sim.is_free ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
                      {sim.is_free ? 'Gratis' : 'Premium'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      sim.status === 'active' ? 'bg-secondary-container text-on-secondary-container' :
                      sim.status === 'draft' ? 'bg-tertiary-fixed/50 text-on-tertiary-fixed' :
                      'bg-surface-container-high text-outline'
                    }`}>
                      {sim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => onDelete(sim.id, e)}
                      className="material-symbols-outlined text-[18px] text-outline hover:text-error transition-colors"
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/Simulations.jsx
git commit -m "feat: rewrite Simulations.jsx with exam/custom sections and sessionCount"
```

---

### Task 3: Riscrivere SimulationEditor.jsx

**Files:**
- Modify: `src/pages/admin/SimulationEditor.jsx`

Form differenziato per tipo. Per `exam`: area_config fissa, timer 210, solo titolo/lingua/accesso editabili. Per `custom`: area input per ogni area + timer.

- [ ] **Step 1: Riscrivere il file**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { createSimulation, updateSimulation, deleteSimulation } from '../../lib/adminApi'
import { fetchSimulation } from '../../lib/api'
import { AREAS, EXAM_AREA_CONFIG, EXAM_TIMER } from '../../data/areas'

const EMPTY_EXAM = {
  type: 'exam',
  title: '',
  lang: 'it',
  is_free: false,
  status: 'active',
  timer: EXAM_TIMER,
  area_config: EXAM_AREA_CONFIG,
}

const EMPTY_CUSTOM = {
  type: 'custom',
  title: '',
  lang: 'it',
  is_free: false,
  status: 'active',
  timer: 60,
  area_config: Object.fromEntries(Object.keys(AREAS).map(k => [k, 0])),
}

export default function AdminSimulationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'
  const defaultType = searchParams.get('type') || 'exam'

  const [form, setForm] = useState(isNew
    ? (defaultType === 'exam' ? EMPTY_EXAM : EMPTY_CUSTOM)
    : null
  )
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isNew) {
      fetchSimulation(id)
        .then(data => {
          setForm({
            type: data.type || 'custom',
            title: data.title || '',
            lang: data.lang || 'it',
            is_free: data.is_free || false,
            status: data.status || 'active',
            timer: data.timer || 60,
            area_config: data.area_config || {},
          })
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [id])

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function setAreaCount(areaId, val) {
    setForm(prev => ({
      ...prev,
      area_config: { ...prev.area_config, [String(areaId)]: Math.max(0, Number(val) || 0) },
    }))
  }

  function totalCustomQuestions() {
    return Object.values(form.area_config || {}).reduce((sum, n) => sum + Number(n), 0)
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Il titolo è obbligatorio'); return }
    if (form.type === 'custom' && totalCustomQuestions() === 0) { setError('Devi selezionare almeno una domanda'); return }
    if (form.type === 'custom' && totalCustomQuestions() > 100) { setError('Massimo 100 domande totali'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: form.title,
        type: form.type,
        lang: form.lang,
        is_free: form.is_free,
        status: form.status,
        timer: form.type === 'exam' ? EXAM_TIMER : Number(form.timer),
        area_config: form.type === 'exam' ? EXAM_AREA_CONFIG : form.area_config,
      }
      if (isNew) {
        const sim = await createSimulation(payload)
        navigate(`/admin/simulations/${sim.id}`)
      } else {
        await updateSimulation(id, payload)
        navigate('/admin/simulations')
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Eliminare questa simulazione? Tutte le sessioni collegate verranno eliminate.')) return
    await deleteSimulation(id)
    navigate('/admin/simulations')
  }

  if (loading || !form) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    )
  }

  const isExam = form.type === 'exam'

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin/simulations')} className="p-2 hover:bg-surface-container-high rounded-lg">
            <span className="material-symbols-outlined text-[20px] text-secondary">arrow_back</span>
          </button>
          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">
              {isNew ? (isExam ? 'Nuova simulazione esame' : 'Nuova simulazione custom') : 'Modifica simulazione'}
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isExam ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
              {isExam ? 'Esame' : 'Custom'}
            </span>
          </div>
        </div>

        <div className="space-y-5">

          {/* Titolo */}
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">Titolo *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              className="input w-full"
              placeholder={isExam ? 'es. Esame FPH – Aprile 2026' : 'es. Focus Farmacia Clinica'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">Stato</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)} className="input w-full">
                <option value="active">Attivo</option>
                <option value="draft">Bozza</option>
                <option value="archived">Archiviato</option>
              </select>
            </div>
          </div>

          {/* Timer */}
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">Timer</label>
            {isExam ? (
              <div className="input w-full bg-surface-container text-outline cursor-not-allowed">
                210 minuti (fisso per l'esame FPH)
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.timer}
                  onChange={e => setField('timer', Number(e.target.value) || 0)}
                  className="input w-32"
                  min="1"
                  max="480"
                />
                <span className="text-sm text-outline">minuti</span>
              </div>
            )}
          </div>

          {/* Accesso */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_free"
              checked={form.is_free}
              onChange={e => setField('is_free', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="is_free" className="text-sm font-semibold text-on-surface-variant">Accesso gratuito (senza premium)</label>
          </div>

          {/* Area config */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-on-surface-variant">
                Distribuzione domande per area
              </label>
              {!isExam && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${totalCustomQuestions() > 100 ? 'bg-error-container text-error' : 'bg-secondary-container text-on-secondary-container'}`}>
                  {totalCustomQuestions()} / 100
                </span>
              )}
            </div>

            <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-xs text-outline uppercase">
                    <th className="text-left px-4 py-2">Area</th>
                    <th className="text-left px-4 py-2 w-28">Domande</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(AREAS).map(([areaId, area]) => {
                    const count = Number(form.area_config?.[areaId] ?? 0)
                    return (
                      <tr key={areaId} className="border-b border-outline-variant/10">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${area.color}`}>R{areaId}</span>
                            <span className="text-on-surface">{area.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {isExam ? (
                            <span className="font-mono font-medium text-on-surface">{count}</span>
                          ) : (
                            <input
                              type="number"
                              value={count === 0 ? '' : count}
                              onChange={e => setAreaCount(areaId, e.target.value)}
                              className="input w-20 text-center"
                              min="0"
                              max="100"
                              placeholder="0"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Salvataggio...' : 'Salva'}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/SimulationEditor.jsx
git commit -m "feat: rewrite SimulationEditor with exam/custom forms and area_config"
```
