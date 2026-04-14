import { supabase } from './supabase'

// ===== SIMULAZIONI (template) =====

export async function fetchSimulations() {
  const { data, error } = await supabase
    .from('simulations')
    .select('*')
    .eq('status', 'active')
    .order('type', { ascending: true })
    .order('title', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchSimulation(id) {
  const { data, error } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ===== SESSIONI =====

// Avvia una nuova sessione: pesca le domande e salva in quiz_sessions
export async function startSession(simulationId, userId) {
  const sim = await fetchSimulation(simulationId)
  const areaConfig = sim.area_config || {}

  // Carica la history dell'utente
  const { data: history } = await supabase
    .from('user_question_history')
    .select('question_id')
    .eq('user_id', userId)
  const seenIds = new Set((history || []).map(r => r.question_id))

  // Pesca domande per ogni area
  const pickedIds = []
  for (const [areaStr, count] of Object.entries(areaConfig)) {
    const area = Number(areaStr)
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('area', area)
      .eq('status', 'active')
    if (!questions || questions.length === 0) continue

    const unseen = questions.filter(q => !seenIds.has(q.id))
    const seen = questions.filter(q => seenIds.has(q.id))
    const pool = [...shuffle(unseen), ...shuffle(seen)]
    pickedIds.push(...pool.slice(0, count).map(q => q.id))
  }

  const { data: session, error } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: userId,
      simulation_id: simulationId,
      question_ids: pickedIds,
      answers: {},
      current_index: 0,
      status: 'in_progress',
    })
    .select()
    .single()
  if (error) throw error
  return session
}

// Carica una sessione con le domande risolte
export async function fetchSession(sessionId) {
  const { data: session, error } = await supabase
    .from('quiz_sessions')
    .select('*, simulations(title, timer, type, area_config)')
    .eq('id', sessionId)
    .single()
  if (error) throw error

  if (!session.question_ids?.length) return { ...session, questions: [] }

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .in('id', session.question_ids)
  if (!questions) return { ...session, questions: [] }

  // Preserva l'ordine originale
  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))
  const ordered = session.question_ids.map(id => qMap[id]).filter(Boolean)

  return { ...session, questions: ordered }
}

export async function fetchUserSessions(userId) {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*, simulations(title, type)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveSessionProgress(sessionId, answers, currentIndex) {
  const { error } = await supabase
    .from('quiz_sessions')
    .update({ answers, current_index: currentIndex })
    .eq('id', sessionId)
  if (error) throw error
}

export async function completeSession(sessionId, answers, score, total) {
  const { error } = await supabase
    .from('quiz_sessions')
    .update({
      answers,
      score,
      total,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
  if (error) throw error
}

export async function markQuestionsSeen(userId, questionIds) {
  if (!questionIds?.length) return
  const rows = questionIds.map(qid => ({ user_id: userId, question_id: qid }))
  await supabase
    .from('user_question_history')
    .upsert(rows, { onConflict: 'user_id,question_id', ignoreDuplicates: true })
}

// ===== HELPERS =====

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
