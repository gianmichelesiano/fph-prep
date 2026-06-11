import { supabase } from './supabase'

// ===== AREE (con progresso utente) =====

export async function fetchAreasWithProgress() {
  const { data: areas, error } = await supabase
    .from('areas')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return areas || []
}

export async function fetchUserAreaProgress() {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []
  const { data, error } = await supabase
    .from('user_area_progress')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    // Tabella non ancora creata (migration 009 pending)
    if (error.code === '42P01') return []
    throw error
  }
  return data || []
}

// ===== AREA DETAIL =====

export async function fetchAreaDetail(areaId) {
  const [areaRes, topicsRes] = await Promise.all([
    supabase.from('areas').select('*').eq('id', areaId).single(),
    supabase.from('topics').select('*').eq('area_id', areaId).order('name').then(
      r => r,
      () => ({ data: [], error: null })
    ),
  ])
  if (areaRes.error) throw areaRes.error
  // topics table may not exist yet (migration 009 pending)
  if (topicsRes.error && topicsRes.error.code !== '42P01') throw topicsRes.error
  return {
    area: areaRes.data,
    topics: topicsRes.data || [],
  }
}

// ===== DOMANDE PER AREA =====

export async function fetchAreaQuestions(areaId, { topicId, difficulty, status } = {}) {
  let query = supabase
    .from('questions')
    .select('*')
    .eq('area', areaId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (topicId) query = query.eq('topic_id', topicId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ===== QUIZ PER AREA =====

export async function startAreaQuiz(areaId, config) {
  let query = supabase
    .from('questions')
    .select('id, text, type, options, correct_answer, explanation, area, topic_id')
    .eq('area', areaId)
    .eq('status', 'active')

  if (config.format && config.format !== 'mixed') {
    const type = config.format === 'MC-A' ? 'multiple_choice' : 'kprim'
    query = query.eq('type', type)
  }
  if (config.only_errors) {
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.session?.user?.id
    if (userId) {
      const { data: wrong } = await supabase
        .from('quiz_answers')
        .select('question_id')
        .eq('user_id', userId)
        .eq('is_correct', false)
      if (wrong?.length) {
        query = query.in('id', [...new Set(wrong.map(w => w.question_id))])
      }
    }
  }

  const count = config.question_count === -1 ? 900 : config.question_count
  const { data, error } = await query.limit(count)
  if (error) throw error

  const items = data || []
  // Shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]]
  }
  const final = items.slice(0, count)

  // Store quiz session
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  let quizId = null
  if (userId) {
    const { data: qs } = await supabase
      .from('quiz_sessions')
      .insert({
        user_id: userId,
        area_id: areaId,
        status: 'in_progress',
        question_ids: final.map(q => q.id),
      })
      .select('id')
      .single()
    if (qs) quizId = qs.id
  }

  return { quiz_id: quizId, questions: final }
}

export async function submitAreaQuiz(quizId, answers) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id

  // answers: { [question_id]: answer }
  const questionIds = Object.keys(answers)
  const { data: questions } = await supabase
    .from('questions')
    .select('id, correct_answer, explanation, topic_id')
    .in('id', questionIds)

  const questionsMap = {}
  ;(questions || []).forEach(q => { questionsMap[q.id] = q })

  let score = 0
  const results = []

  for (const [qId, userAnswer] of Object.entries(answers)) {
    const q = questionsMap[qId]
    if (!q) continue
    let isCorrect = false

    if (typeof q.correct_answer === 'string') {
      isCorrect = userAnswer === q.correct_answer
    } else if (Array.isArray(q.correct_answer)) {
      isCorrect = Array.isArray(userAnswer) &&
        userAnswer.length === q.correct_answer.length &&
        userAnswer.every((v, i) => v === q.correct_answer[i])
    }

    if (isCorrect) score++

    results.push({
      question_id: qId,
      user_answer: userAnswer,
      correct_answer: q.correct_answer,
      is_correct: isCorrect,
      explanation: q.explanation,
      topic_id: q.topic_id,
    })
  }

  // Save answers
  if (userId && quizId) {
    const answerRows = results.map(r => ({
      quiz_session_id: quizId,
      user_id: userId,
      question_id: r.question_id,
      user_answer: typeof r.user_answer === 'string' ? r.user_answer : JSON.stringify(r.user_answer),
      correct_answer: typeof r.correct_answer === 'string' ? r.correct_answer : JSON.stringify(r.correct_answer),
      is_correct: r.is_correct,
    }))

    await supabase.from('quiz_answers').upsert(answerRows, { onConflict: 'quiz_session_id,question_id' })

    // Update quiz session
    await supabase
      .from('quiz_sessions')
      .update({ status: 'completed', score, total: results.length, completed_at: new Date().toISOString() })
      .eq('id', quizId)

    // Update area progress
    if (results.length > 0) {
      const areaId = questions?.[0]?.area
      if (areaId) {
        await supabase.from('user_area_progress').upsert(
          {
            user_id: userId,
            area_id: areaId,
            questions_completed: results.length,
            questions_correct: score,
            last_quiz_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,area_id' }
        )
      }
    }
  }

  return { score, total: results.length, results }
}

// ===== PROGRESSO PER AREA =====

export async function fetchAreaProgress(areaId) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return null
  const { data } = await supabase
    .from('user_area_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('area_id', areaId)
    .maybeSingle()
  return data
}

export async function fetchAllAreaProgress() {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []
  const { data, error } = await supabase
    .from('user_area_progress')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data || []
}
