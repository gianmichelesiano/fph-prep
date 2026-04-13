import { supabase } from './supabase'

// Converte domanda DB → formato interno app
function normalizeDbQuestion(dbQ, index) {
  const base = {
    id: dbQ.id,
    type: dbQ.type === 'multiple_choice' ? 'multiple' : 'truefalse',
    text: dbQ.text,
    topic: dbQ.topic,
    motivation: dbQ.explanation,
  }

  if (dbQ.type === 'multiple_choice') {
    const opts = dbQ.options || {}
    const options = ['A', 'B', 'C', 'D'].map(k => opts[k]).filter(Boolean)
    const correct = dbQ.correct_answer
      ? dbQ.correct_answer.toUpperCase().charCodeAt(0) - 65
      : 0
    return { ...base, options, correct }
  } else {
    const opts = dbQ.options || {}
    const rc = (dbQ.correct_answer || '').toUpperCase()
    const items = ['1', '2', '3', '4'].map((k, i) => ({
      text: opts[k] ?? '',
      correct: rc[i] === 'V',
    })).filter(item => item.text !== '')
    return { ...base, items }
  }
}

export async function fetchSimulations() {
  const { data, error } = await supabase
    .from('simulations')
    .select('*')
    .eq('status', 'active')
    .order('area', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchSimulation(id) {
  // Prova per UUID
  const { data: sim, error: simError } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .single()

  if (simError) throw simError

  const questions = await fetchSimulationQuestions(sim.id)

  return {
    id: sim.id,
    legacyId: sim.legacy_id,
    title: sim.title,
    area: sim.area,
    timer: sim.timer,
    is_free: sim.is_free,
    lang: sim.lang,
    questions,
  }
}

export async function fetchSimulationByLegacyId(legacyId) {
  const { data: sim, error } = await supabase
    .from('simulations')
    .select('*')
    .eq('legacy_id', legacyId)
    .single()
  if (error) throw error

  const questions = await fetchSimulationQuestions(sim.id)
  return {
    id: sim.id,
    legacyId: sim.legacy_id,
    title: sim.title,
    area: sim.area,
    timer: sim.timer,
    is_free: sim.is_free,
    lang: sim.lang,
    questions,
  }
}

export async function fetchSimulationQuestions(simulationId) {
  const { data, error } = await supabase
    .from('simulation_questions')
    .select('position, questions(*)')
    .eq('simulation_id', simulationId)
    .order('position', { ascending: true })

  if (error) throw error

  return (data || [])
    .map((row, i) => normalizeDbQuestion(row.questions, i))
    .filter(Boolean)
}
