import { supabase } from './supabase'

function normalizeDbQuestion(q) {
  if (q.type === 'multiple_choice') {
    const opts = q.options || {}
    const options = ['A', 'B', 'C', 'D'].map(k => opts[k]).filter(Boolean)
    const correct = q.correct_answer
      ? q.correct_answer.toUpperCase().charCodeAt(0) - 65
      : 0
    return { ...q, type: 'multiple', options, correct, motivation: q.explanation }
  } else {
    const opts = q.options || {}
    const rc = (q.correct_answer || '').toUpperCase()
    const items = ['1', '2', '3', '4']
      .map((k, i) => ({ text: opts[k] || '', correct: rc[i] === 'V' }))
      .filter(item => item.text !== '')
    return { ...q, type: 'truefalse', items, motivation: q.explanation }
  }
}

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

// Avvia una nuova sessione usando le domande pre-salvate nella simulazione
export async function startSession(simulationId, userId) {
  const sim = await fetchSimulation(simulationId)
  const questionIds = sim.question_ids || []

  if (questionIds.length === 0) throw new Error('La simulazione non ha domande. Salvala di nuovo dall\'admin.')

  const { data: session, error } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: userId,
      simulation_id: simulationId,
      question_ids: questionIds,
      answers: {},
      current_index: 0,
      status: 'in_progress',
    })
    .select()
    .single()
  if (error) throw error
  return session
}

// Pesca domande per area_config e ritorna gli UUID ordinati (usato dall'admin al salvataggio)
export async function pickQuestionsForSimulation(areaConfig) {
  const areas = Object.keys(areaConfig).map(Number).filter(a => Number(areaConfig[a]) > 0)
  if (areas.length === 0) return []

  const areaResults = await Promise.all(
    areas.map(area =>
      supabase.from('questions').select('id').eq('area', area).eq('status', 'active')
    )
  )

  const pickedIds = []
  areas.forEach((area, i) => {
    const count = Number(areaConfig[area])
    const questions = areaResults[i].data || []
    pickedIds.push(...shuffle(questions).slice(0, count).map(q => q.id))
  })

  return pickedIds
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
  const ordered = session.question_ids.map(id => qMap[id]).filter(Boolean).map(normalizeDbQuestion)

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
