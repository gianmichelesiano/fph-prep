import { supabase } from './supabase'

// Fetch singolo contenuto by notebook key + lang.
// Ritorna { id, key, title, area_id, argomento, content: { content_md, is_free, updated_at } } o null.
export async function fetchContentByKey(key, lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento, notebook_contents!inner(content_md, is_free, updated_at, lang)')
    .eq('key', key)
    .eq('active', true)
    .eq('notebook_contents.lang', lang)
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  if (!data) return null
  const content = (data.notebook_contents || [])[0] || null
  return { ...data, notebook_contents: undefined, content }
}

// Fetch notebook metadata by key (no content join — always returns if notebook exists).
export async function fetchNotebookByKey(key) {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento')
    .eq('key', key)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

// Lista notebooks (topic) per area, con flag hasContent + isFree.
export async function fetchNotebooksByArea(areaId, lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento, notebook_contents(is_free, updated_at, lang)')
    .eq('area_id', areaId)
    .eq('active', true)
    .order('title')
  if (error) throw error
  return (data || []).map(n => {
    const content = (n.notebook_contents || []).find(c => c.lang === lang)
    return {
      id: n.id,
      key: n.key,
      title: n.title,
      area_id: n.area_id,
      argomento: n.argomento,
      hasContent: !!content,
      isFree: content?.is_free ?? false,
      updatedAt: content?.updated_at ?? null,
    }
  })
}

// Conteggio per area: quanti notebook hanno contenuto nella lingua.
export async function fetchAreaCounts(lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('area_id, notebook_contents(lang)')
    .eq('active', true)
  if (error) throw error
  const counts = {}
  for (const n of data || []) {
    const has = (n.notebook_contents || []).some(c => c.lang === lang)
    if (n.area_id == null) continue
    if (!counts[n.area_id]) counts[n.area_id] = { total: 0, withContent: 0 }
    counts[n.area_id].total += 1
    if (has) counts[n.area_id].withContent += 1
  }
  return counts
}

// Admin: lista tutti i notebook con stato contenuto.
export async function fetchAllNotebooksAdmin(lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento, active, notebook_contents(is_free, updated_at, lang)')
    .order('area_id')
    .order('title')
  if (error) throw error
  return (data || []).map(n => {
    const content = (n.notebook_contents || []).find(c => c.lang === lang)
    return {
      id: n.id,
      key: n.key,
      title: n.title,
      area_id: n.area_id,
      argomento: n.argomento,
      active: n.active,
      hasContent: !!content,
      isFree: content?.is_free ?? false,
      updatedAt: content?.updated_at ?? null,
    }
  })
}

// Admin: ottiene contenuto per editing.
export async function fetchContentForEdit(notebookId, lang = 'it') {
  const [{ data: nb, error: nbErr }, { data: content, error: cErr }] = await Promise.all([
    supabase.from('notebooks').select('id, key, title, area_id, argomento').eq('id', notebookId).single(),
    supabase
      .from('notebook_contents')
      .select('content_md, is_free, updated_at')
      .eq('notebook_id', notebookId)
      .eq('lang', lang)
      .maybeSingle(),
  ])
  if (nbErr) throw nbErr
  if (cErr) throw cErr
  return { notebook: nb, content: content || { content_md: '', is_free: false, updated_at: null } }
}

// Admin: upsert contenuto.
export async function upsertContent({ notebook_id, lang = 'it', content_md, is_free }) {
  const { data, error } = await supabase
    .from('notebook_contents')
    .upsert(
      {
        notebook_id,
        lang,
        content_md,
        is_free,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'notebook_id,lang' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// Fetch study path artifacts (study_guide, flashcards, mind_map) for a notebook.
// Returns array of { id, type, title, format, content, created_at }, one per type (latest).
export async function fetchStudyPath(notebookId) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, type, title, format, content, created_at')
    .eq('notebook_id', notebookId)
    .in('type', ['study_guide', 'flashcards', 'quiz'])
    .order('created_at', { ascending: false })
  if (error) throw error
  const seen = new Set()
  return (data || []).filter(a => {
    if (seen.has(a.type)) return false
    seen.add(a.type)
    return true
  })
}

// Admin: upload immagine a summaries/<key>/<timestamp>-<filename>, ritorna URL pubblico.
export async function uploadSummaryImage(notebookKey, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${notebookKey}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('summaries').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('summaries').getPublicUrl(path)
  return data.publicUrl
}
