import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import {
  fetchAreaDetail,
  updateArea,
  createTopic,
  updateTopic,
  deleteTopic,
} from '../../lib/adminApi'
import {
  fetchAreaNotebooks,
  fetchNotebooks,
  linkNotebookArea,
  unlinkNotebookArea,
  fetchTopicResources,
  addTopicResource,
  removeTopicResource,
  fetchResources,
} from '../../lib/adminBackendApi'

export default function AdminAreaDetail() {
  const { area_id } = useParams()
  const navigate = useNavigate()
  const [area, setArea] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingArea, setSavingArea] = useState(false)
  const [savedAreaMsg, setSavedAreaMsg] = useState(null)

  // Topic editing
  const [newTopicName, setNewTopicName] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [editingTopicId, setEditingTopicId] = useState(null)
  const [editingTopicName, setEditingTopicName] = useState('')

  // Notebook linking
  const [linkedNotebooks, setLinkedNotebooks] = useState([])
  const [allNotebooks, setAllNotebooks] = useState([])
  const [linkingNotebook, setLinkingNotebook] = useState(false)
  const [notebookSearch, setNotebookSearch] = useState('')
  const [showAddNotebook, setShowAddNotebook] = useState(false)

  // Topic resources (expanded topic)
  const [expandedTopicResources, setExpandedTopicResources] = useState(null) // topicId or null
  const [topicResources, setTopicResources] = useState({})
  const [allResources, setAllResources] = useState([])
  const [addingResourceTo, setAddingResourceTo] = useState(null)

  const areaId = Number(area_id)

  function load() {
    setLoading(true)
    fetchAreaDetail(areaId)
      .then(data => {
        setArea(data)
        setTopics(data.topics || [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [areaId])

  // Load linked notebooks
  useEffect(() => {
    fetchAreaNotebooks(areaId).then(data => setLinkedNotebooks(data || [])).catch(() => {})
  }, [areaId])

  // Load all notebooks for linking
  useEffect(() => {
    fetchNotebooks({ limit: 500 }).then(data => setAllNotebooks(data || [])).catch(() => {})
  }, [])

  // Load all resources once for topic resource linking
  useEffect(() => {
    fetchResources({ limit: 500 }).then(data => setAllResources(data || [])).catch(() => {})
  }, [])

  async function handleLinkNotebook(notebookId) {
    setLinkingNotebook(true)
    try {
      await linkNotebookArea(notebookId, areaId)
      const updated = await fetchAreaNotebooks(areaId)
      setLinkedNotebooks(updated || [])
      setShowAddNotebook(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setLinkingNotebook(false)
    }
  }

  async function handleUnlinkNotebook(notebookId) {
    if (!confirm('Scollegare questo notebook?')) return
    try {
      await unlinkNotebookArea(notebookId, areaId)
      setLinkedNotebooks(prev => prev.filter(n => n.id !== notebookId))
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleLoadTopicResources(topicId) {
    if (expandedTopicResources === topicId) {
      setExpandedTopicResources(null)
      return
    }
    setExpandedTopicResources(topicId)
    try {
      const data = await fetchTopicResources(topicId)
      setTopicResources(prev => ({ ...prev, [topicId]: data || [] }))
    } catch { /* */ }
  }

  async function handleAddTopicResource(topicId, resourceId) {
    try {
      await addTopicResource(topicId, resourceId)
      const updated = await fetchTopicResources(topicId)
      setTopicResources(prev => ({ ...prev, [topicId]: updated || [] }))
      setAddingResourceTo(null)
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleRemoveTopicResource(topicId, resourceId) {
    try {
      await removeTopicResource(topicId, resourceId)
      setTopicResources(prev => ({
        ...prev,
        [topicId]: (prev[topicId] || []).filter(r => r.id !== resourceId),
      }))
    } catch (e) {
      alert(e.message)
    }
  }

  // Notebooks available to link (not already linked)
  const availableNotebooks = useMemo(() => {
    const linkedIds = new Set(linkedNotebooks.map(n => n.id))
    let avail = allNotebooks.filter(n => !linkedIds.has(n.id))
    if (notebookSearch.trim()) {
      const q = notebookSearch.toLowerCase()
      avail = avail.filter(n => (n.title || n.key || '').toLowerCase().includes(q))
    }
    return avail.slice(0, 50)
  }, [allNotebooks, linkedNotebooks, notebookSearch])

  async function handleSaveArea(field, value) {
    setSavingArea(true)
    setSavedAreaMsg(null)
    try {
      const updated = await updateArea(areaId, { [field]: value })
      setArea(prev => ({ ...prev, ...updated }))
      setSavedAreaMsg('Salvato')
      setTimeout(() => setSavedAreaMsg(null), 1500)
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingArea(false)
    }
  }

  async function handleAddTopic() {
    if (!newTopicName.trim()) return
    setAddingTopic(true)
    try {
      const created = await createTopic(areaId, { name: newTopicName.trim() })
      setTopics(prev => [...prev, created])
      setNewTopicName('')
    } catch (e) {
      alert(e.message)
    } finally {
      setAddingTopic(false)
    }
  }

  async function handleUpdateTopic(id, name) {
    try {
      const updated = await updateTopic(id, { name })
      setTopics(prev => prev.map(t => t.id === id ? updated : t))
      setEditingTopicId(null)
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleDeleteTopic(id) {
    if (!confirm('Eliminare questo topic?')) return
    try {
      await deleteTopic(id)
      setTopics(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 text-sm text-outline">Caricamento...</div>
      </AdminLayout>
    )
  }

  if (error || !area) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p className="text-error text-sm">{error || 'Area non trovata'}</p>
          <Link to="/admin/areas" className="text-primary text-sm underline mt-2 inline-block">← Torna alle aree</Link>
        </div>
      </AdminLayout>
    )
  }

  const isHighlighted = area.role_number === 4

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl">
        <Link to="/admin/areas" className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Aree
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${area.color_class || 'bg-surface-container-high'}`}>
              Area {area.role_number || area.id}
            </div>
            {isHighlighted && (
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">50% esame</span>
            )}
          </div>
          <h2 className="font-headline font-bold text-2xl text-on-surface">{area.name}</h2>
        </div>

        {savedAreaMsg && (
          <div className="mb-4 px-3 py-2 bg-green-100 text-green-800 text-sm rounded-lg">{savedAreaMsg}</div>
        )}

        {/* Metadata form */}
        <section className="card mb-6">
          <h3 className="font-bold text-on-surface mb-4">Metadati</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EditableField label="Peso %" value={area.weight_percent} type="number" onSave={v => handleSaveArea('weight_percent', v)} disabled={savingArea} />
            <EditableField label="Domande" value={area.questions_count} type="number" onSave={v => handleSaveArea('questions_count', v)} disabled={savingArea} />
            <EditableField label="Giorni studio" value={area.study_days} type="number" onSave={v => handleSaveArea('study_days', v)} disabled={savingArea} />
            <EditableField label="Numero area" value={area.role_number} type="number" onSave={v => handleSaveArea('role_number', v)} disabled={savingArea} />
          </div>
          <div className="mt-4">
            <EditableField label="Descrizione" value={area.description} type="textarea" onSave={v => handleSaveArea('description', v)} disabled={savingArea} />
          </div>
        </section>

        {/* Linked Notebooks */}
        <section className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface">Notebook collegati ({linkedNotebooks.length})</h3>
            <button
              onClick={() => setShowAddNotebook(!showAddNotebook)}
              className="btn-secondary text-sm"
            >
              {showAddNotebook ? 'Chiudi' : '+ Collega'}
            </button>
          </div>

          {showAddNotebook && (
            <div className="mb-4 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
              <input
                className="input text-sm w-full mb-2"
                placeholder="Cerca notebook..."
                value={notebookSearch}
                onChange={e => setNotebookSearch(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableNotebooks.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleLinkNotebook(n.id)}
                    disabled={linkingNotebook}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-container-low transition-colors flex justify-between items-center"
                  >
                    <span>{n.title || n.key}</span>
                    <span className="text-[10px] text-outline">#{n.id}</span>
                  </button>
                ))}
                {availableNotebooks.length === 0 && (
                  <p className="text-xs text-outline p-2">
                    {notebookSearch ? 'Nessun notebook trovato.' : 'Tutti i notebook già collegati.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {linkedNotebooks.length === 0 ? (
            <p className="text-sm text-outline">Nessun notebook collegato.</p>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {linkedNotebooks.map(n => (
                <div key={n.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm text-on-surface">{n.title || n.key || `#${n.id}`}</span>
                  </div>
                  <button
                    onClick={() => handleUnlinkNotebook(n.id)}
                    className="material-symbols-outlined text-[18px] text-outline hover:text-error"
                  >
                    link_off
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Topics */}
        <section className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface">Topics ({topics.length})</h3>
          </div>

          {/* Add topic */}
          <div className="flex gap-2 mb-4">
            <input
              className="input flex-1"
              placeholder="Nuovo topic..."
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTopic() }}
            />
            <button
              onClick={handleAddTopic}
              disabled={addingTopic || !newTopicName.trim()}
              className="btn-primary text-sm"
            >
              {addingTopic ? '...' : 'Aggiungi'}
            </button>
          </div>

          {topics.length === 0 ? (
            <p className="text-sm text-outline">Nessun topic ancora.</p>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {topics.map(t => {
                const tResources = topicResources[t.id] || []
                const isExpanded = expandedTopicResources === t.id
                return (
                <div key={t.id}>
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editingTopicId === t.id ? (
                      <input
                        autoFocus
                        className="input w-full"
                        value={editingTopicName}
                        onChange={e => setEditingTopicName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateTopic(t.id, editingTopicName)
                          if (e.key === 'Escape') setEditingTopicId(null)
                        }}
                      />
                    ) : (
                      <div>
                        <button
                          onClick={() => navigate(`/admin/areas/${area_id}/topics/${t.id}`)}
                          className="font-medium text-on-surface hover:text-primary transition-colors text-left"
                        >
                          {t.name}
                        </button>
                        {t.description && <p className="text-xs text-on-surface-variant mt-0.5">{t.description}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {editingTopicId === t.id ? (
                      <>
                        <button onClick={() => handleUpdateTopic(t.id, editingTopicName)} className="text-xs text-primary hover:underline">Salva</button>
                        <button onClick={() => setEditingTopicId(null)} className="text-xs text-outline hover:underline">Annulla</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingTopicId(t.id); setEditingTopicName(t.name) }} className="material-symbols-outlined text-[18px] text-outline hover:text-primary">edit</button>
                        <button onClick={() => handleDeleteTopic(t.id)} className="material-symbols-outlined text-[18px] text-outline hover:text-error">delete</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Topic resources */}
                <div className="ml-4 mb-3">
                  <button
                    onClick={() => handleLoadTopicResources(t.id)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                    Risorse ({tResources.length})
                  </button>

                  {isExpanded && (
                    <div className="mt-2 ml-5 space-y-1">
                      {tResources.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded hover:bg-surface-container-low">
                          <span className="text-on-surface">{r.title || r.name || `Risorsa #${r.id}`}</span>
                          <span className="text-[10px] text-outline">{r.type}</span>
                          <button
                            onClick={() => handleRemoveTopicResource(t.id, r.id)}
                            className="material-symbols-outlined text-[14px] text-outline hover:text-error"
                          >
                            close
                          </button>
                        </div>
                      ))}

                      {/* Add resource */}
                      {addingResourceTo === t.id ? (
                        <div className="pt-1">
                          <select
                            className="input text-xs w-full mb-1"
                            onChange={e => {
                              if (e.target.value) handleAddTopicResource(t.id, Number(e.target.value))
                            }}
                            value=""
                          >
                            <option value="">Seleziona risorsa...</option>
                            {allResources
                              .filter(r => !tResources.some(tr => tr.id === r.id))
                              .map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.title || r.name || `#${r.id}`} ({r.type})
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => setAddingResourceTo(null)}
                            className="text-xs text-outline hover:underline"
                          >
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingResourceTo(t.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          + Aggiungi risorsa
                        </button>
                      )}
                      <p className="text-[10px] text-outline/60 mt-1">
                        Le risorse sono gli input per la generazione artifact.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              )
              })}
            </div>
          )}
        </section>

        {/* Learning objectives */}
        <section className="card">
          <h3 className="font-bold text-on-surface mb-4">Learning Objectives</h3>
          <LearningObjectivesEditor
            objectives={area.learning_objectives || []}
            onSave={async (objectives) => handleSaveArea('learning_objectives', objectives)}
            disabled={savingArea}
          />
        </section>
      </div>
    </AdminLayout>
  )
}

function EditableField({ label, value, type = 'text', onSave, disabled }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  function handleSave() {
    const parsed = type === 'number' ? (val === '' ? null : Number(val)) : val
    onSave(parsed)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        <div className="text-xs text-outline uppercase mb-1">{label}</div>
        <button
          onClick={() => { setVal(value ?? ''); setEditing(true) }}
          className="text-on-surface font-medium hover:text-primary transition-colors flex items-center gap-1"
        >
          {value != null ? String(value) : <span className="text-outline italic">—</span>}
          <span className="material-symbols-outlined text-[14px] text-outline">edit</span>
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs text-outline uppercase mb-1">{label}</div>
      <div className="flex gap-2">
        {type === 'textarea' ? (
          <textarea
            autoFocus
            className="input flex-1 min-h-[60px]"
            value={val}
            onChange={e => setVal(e.target.value)}
          />
        ) : (
          <input
            autoFocus
            type={type}
            className="input flex-1"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
        )}
        <button onClick={handleSave} disabled={disabled} className="btn-primary text-sm px-3">OK</button>
        <button onClick={() => setEditing(false)} className="text-xs text-outline hover:underline">✕</button>
      </div>
    </div>
  )
}

function LearningObjectivesEditor({ objectives, onSave, disabled }) {
  // Detect format: structured {id, title, items, verified_by, weight} vs flat {objective, category}
  const isStructured = (obj) => obj && typeof obj === 'object' && 'id' in obj && 'title' in obj
  const [structured, setStructured] = useState(() => {
    const arr = objectives || []
    if (arr.length === 0) return []
    if (isStructured(arr[0])) return arr
    // Convert flat to structured
    return arr.map((o, i) => ({
      id: `${i + 1}`,
      title: o.objective || o,
      items: [],
      verified_by: o.category || 'quiz',
      weight: 0,
    }))
  })

  // Add/remove items within an objective
  function updateObjective(idx, field, value) {
    setStructured(prev => prev.map((obj, i) => i === idx ? { ...obj, [field]: value } : obj))
  }

  function addItemToObjective(objIdx) {
    setStructured(prev => prev.map((obj, i) =>
      i === objIdx ? { ...obj, items: [...(obj.items || []), ''] } : obj
    ))
  }

  function updateItemInObjective(objIdx, itemIdx, value) {
    setStructured(prev => prev.map((obj, i) =>
      i === objIdx ? { ...obj, items: obj.items.map((it, j) => j === itemIdx ? value : it) } : obj
    ))
  }

  function removeItemFromObjective(objIdx, itemIdx) {
    setStructured(prev => prev.map((obj, i) =>
      i === objIdx ? { ...obj, items: obj.items.filter((_, j) => j !== itemIdx) } : obj
    ))
  }

  function addObjective() {
    const nextId = String(structured.length + 1)
    setStructured(prev => [...prev, { id: nextId, title: '', items: [], verified_by: 'quiz', weight: 0 }])
  }

  function removeObjective(idx) {
    setStructured(prev => prev.filter((_, i) => i !== idx))
  }

  function handleSave() {
    // Remove empty items strings
    const cleaned = structured.map(obj => ({
      ...obj,
      items: (obj.items || []).filter(it => it.trim() !== ''),
    }))
    onSave(cleaned)
  }

  return (
    <div>
      {structured.length === 0 ? (
        <div className="text-sm text-outline mb-4">Nessun obiettivo. Clicca "Aggiungi obiettivo" per iniziare.</div>
      ) : (
        <div className="space-y-4 mb-4">
          {structured.map((obj, idx) => (
            <div key={idx} className="border border-outline-variant/20 rounded-xl p-4 bg-surface-container-lowest">
              {/* Header row: ID + Title */}
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {obj.id}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    className="input w-full font-semibold text-on-surface"
                    placeholder="Titolo competenza..."
                    value={obj.title || ''}
                    onChange={e => updateObjective(idx, 'title', e.target.value)}
                  />
                </div>
                <button onClick={() => removeObjective(idx)} className="text-outline hover:text-error shrink-0 mt-1">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>

              {/* Items */}
              <div className="ml-12 space-y-1.5 mb-3">
                {(obj.items || []).map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center gap-2">
                    <span className="text-[10px] text-outline shrink-0">•</span>
                    <input
                      className="input flex-1 text-sm py-1"
                      value={item}
                      onChange={e => updateItemInObjective(idx, iIdx, e.target.value)}
                      placeholder="Elemento della competenza..."
                    />
                    <button onClick={() => removeItemFromObjective(idx, iIdx)} className="text-outline hover:text-error shrink-0">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addItemToObjective(idx)}
                  className="text-xs text-primary hover:underline ml-4"
                >
                  + Aggiungi elemento
                </button>
              </div>

              {/* Meta row */}
              <div className="ml-12 flex gap-4">
                <label className="flex items-center gap-1.5 text-xs text-outline">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <select
                    className="input text-xs py-1"
                    value={obj.verified_by || 'quiz'}
                    onChange={e => updateObjective(idx, 'verified_by', e.target.value)}
                  >
                    <option value="quiz">Quiz</option>
                    <option value="praxisarbeit">Praxisarbeit</option>
                    <option value="quiz + praxisarbeit">Quiz + Praxisarbeit</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-outline">
                  <span>Peso</span>
                  <input
                    type="number"
                    className="input text-xs py-1 w-16"
                    min="0"
                    max="100"
                    value={obj.weight || 0}
                    onChange={e => updateObjective(idx, 'weight', Number(e.target.value))}
                  />
                  <span>%</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button onClick={addObjective} className="btn-secondary text-sm">+ Aggiungi obiettivo</button>
        <button onClick={handleSave} disabled={disabled} className="btn-primary text-sm">
          {disabled ? 'Salvataggio...' : 'Salva obiettivi'}
        </button>
      </div>
    </div>
  )
}
