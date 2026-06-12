import { supabase } from './supabase'

// ===== ALGORITMO SM-2 SEMPLIFICATO =====
//
// Quality scale (come Anki):
//   0 = Again (completely forgot)
//   1 = Hard (recalled with serious difficulty)
//   2 = Hard (recalled with some difficulty)
//   3 = Good (recalled with some effort)
//   4 = Good (recalled with little effort)
//   5 = Easy (perfect recall)
//
// Passing threshold: quality >= 3
//
// Reference: P.A. Wozniak, "SuperMemo 2 Algorithm"
// https://super-memory.com/english/ol/sm2.htm

export const QUALITY = {
  AGAIN: 0,
  HARD: 2,
  GOOD: 3,
  EASY: 5,
}

/**
 * Calcola i nuovi parametri SM-2 per una singola carta/domanda.
 *
 * @param {number} quality - Qualità della risposta (0-5)
 * @param {number} prevEase - Ease factor precedente (default 2.5)
 * @param {number} prevInterval - Intervallo precedente in giorni
 * @param {number} prevRepetitions - Numero di ripetizioni precedenti
 * @returns {{ ease: number, interval: number, repetitions: number, dueDate: Date }}
 */
export function calculateSM2(quality, prevEase = 2.5, prevInterval = 0, prevRepetitions = 0) {
  // Clamp quality
  const q = Math.max(0, Math.min(5, quality))

  let ease = prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  ease = Math.max(1.3, ease) // minimum ease factor

  let interval, repetitions

  if (q >= 3) {
    // Correct answer
    repetitions = prevRepetitions + 1
    if (prevRepetitions === 0) {
      interval = 1
    } else if (prevRepetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(prevInterval * ease)
    }
  } else {
    // Incorrect answer — reset
    repetitions = 0
    interval = 1
  }

  // Calculate due date
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + interval)
  dueDate.setHours(0, 0, 0, 0)

  return { ease: Math.round(ease * 100) / 100, interval, repetitions, dueDate }
}

/**
 * Mappa la correttezza di una risposta al quality score SM-2.
 * Per risposte binarie (corretto/sbagliato):
 *   - Corretto → GOOD (3)
 *   - Sbagliato → AGAIN (0)
 *
 * @param {boolean} isCorrect - Se la risposta è corretta
 * @returns {number} quality score (0-5)
 */
export function answerToQuality(isCorrect) {
  return isCorrect ? QUALITY.GOOD : QUALITY.AGAIN
}

/**
 * Salva (upsert) i parametri SM-2 per una lista di domande.
 * Chiamato dopo aver risposto a un quiz.
 *
 * @param {string} userId - UUID dell'utente
 * @param {Array<{ questionId: string, isCorrect: boolean }>} results
 */
export async function saveSRSResults(userId, results) {
  if (!userId || !results?.length) return

  // Fetch current SRS state for these questions
  const questionIds = results.map(r => r.questionId)
  const { data: existing } = await supabase
    .from('user_question_history')
    .select('question_id, ease_factor, interval_days, repetitions')
    .eq('user_id', userId)
    .in('question_id', questionIds)

  const existingMap = {}
  ;(existing || []).forEach(row => {
    existingMap[row.question_id] = {
      ease: row.ease_factor,
      interval: row.interval_days,
      repetitions: row.repetitions,
    }
  })

  const rows = results.map(({ questionId, isCorrect }) => {
    const prev = existingMap[questionId] || { ease: 2.5, interval: 0, repetitions: 0 }
    const quality = answerToQuality(isCorrect)
    const { ease, interval, repetitions, dueDate } = calculateSM2(
      quality, prev.ease, prev.interval, prev.repetitions
    )

    return {
      user_id: userId,
      question_id: questionId,
      ease_factor: ease,
      interval_days: interval,
      repetitions,
      due_date: dueDate.toISOString().split('T')[0],
      last_result: isCorrect,
      seen_at: new Date().toISOString(),
    }
  })

  await supabase
    .from('user_question_history')
    .upsert(rows, { onConflict: 'user_id,question_id' })
}

/**
 * Recupera le domande da ripassare oggi per un utente.
 *
 * @param {string} userId - UUID dell'utente
 * @returns {Promise<Array>} Domande con due_date <= oggi
 */
export async function fetchDueQuestions(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('user_question_history')
    .select(`
      question_id,
      ease_factor,
      interval_days,
      repetitions,
      due_date,
      last_result,
      questions (
        id, text, type, options, correct_answer, explanation, area, topic_id, difficulty
      )
    `)
    .eq('user_id', userId)
    .lte('due_date', today)
    .order('due_date', { ascending: true })

  if (error) throw error
  return (data || [])
    .filter(row => row.questions) // skip deleted questions
    .map(row => ({
      ...row.questions,
      srs_ease: row.ease_factor,
      srs_interval: row.interval_days,
      srs_repetitions: row.repetitions,
      srs_due_date: row.due_date,
      srs_last_result: row.last_result,
    }))
}

/**
 * Crea una sessione di review con le domande da ripassare oggi.
 * Riutilizza il player delle simulazioni (Quiz.jsx).
 *
 * @param {string} userId - UUID dell'utente
 * @returns {Promise<{ sessionId: string, questions: Array }>}
 */
export async function startReviewSession(userId) {
  const dueRows = await fetchDueQuestions(userId)
  if (!dueRows.length) {
    throw new Error('Nessuna domanda da ripassare oggi')
  }

  // Shuffle questions
  const shuffled = [...dueRows]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const questionIds = shuffled.map(q => q.id)

  // Create quiz session
  const { data: qs, error } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: userId,
      status: 'in_progress',
      question_ids: questionIds,
      area_id: 'review',
    })
    .select('id')
    .single()

  if (error) throw error

  return { sessionId: qs.id, questions: shuffled }
}

/**
 * Conta le domande da ripassare oggi.
 *
 * @param {string} userId - UUID dell'utente
 * @returns {Promise<number>}
 */
export async function countDueQuestions(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { count, error } = await supabase
    .from('user_question_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_date', today)

  if (error) return 0
  return count || 0
}
