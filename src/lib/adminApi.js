import { supabase, supabaseAdmin } from './supabase'

// ===== STATISTICHE =====

export async function getStats() {
  const [
    { count: totalUsers },
    { count: premiumUsers },
    { count: completedQuizzes },
    { data: revenueData },
    { data: scoreData },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
    supabase.from('quiz_progress').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('payments').select('amount').eq('status', 'completed'),
    supabase.from('quiz_progress').select('score, total').eq('status', 'completed'),
  ])

  const totalRevenue = (revenueData || []).reduce((sum, p) => sum + (p.amount || 0), 0) / 100
  const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0
  const passedQuizzes = (scoreData || []).filter(r => r.total > 0 && (r.score / r.total) >= 0.67).length

  return { totalUsers, premiumUsers, completedQuizzes, totalRevenue, conversionRate, passedQuizzes }
}

export async function getRecentActivity(limit = 5) {
  const { data, error } = await supabase
    .from('quiz_progress')
    .select('user_id, saved_at, score, total, profiles(full_name, email)')
    .eq('status', 'completed')
    .order('saved_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data || []).map(row => {
    const name = row.profiles?.full_name || row.profiles?.email?.split('@')[0] || 'User'
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    const pct = row.total > 0 ? Math.round((row.score / row.total) * 100) : 0
    return { name, initials, action: 'Test Completed', status: pct >= 67 ? 'PASSED' : 'COMPLETED', time: row.saved_at }
  })
}

export async function getAreaQuestionCounts() {
  const { data, error } = await supabase.from('questions').select('area')
  if (error) return {}
  const counts = {}
  ;(data || []).forEach(q => {
    if (q.area != null) counts[q.area] = (counts[q.area] || 0) + 1
  })
  return counts
}

export async function getRegistrationTrend(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error

  const counts = {}
  ;(data || []).forEach(row => {
    const date = row.created_at.split('T')[0]
    counts[date] = (counts[date] || 0) + 1
  })

  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

// ===== DOMANDE =====

export async function getAllQuestions({ area, type, lang, status, search, page = 0, pageSize = 50 } = {}) {
  let query = supabase
    .from('questions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (area) query = query.eq('area', area)
  if (type) query = query.eq('type', type)
  if (lang) query = query.eq('lang', lang)
  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('text', `%${search}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { data: data || [], count }
}

export async function createQuestion(data) {
  const { data: q, error } = await supabase
    .from('questions')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return q
}

export async function updateQuestion(id, data) {
  const { data: q, error } = await supabase
    .from('questions')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return q
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

// ===== SIMULAZIONI =====

export async function getAllSimulations() {
  const { data, error } = await supabase
    .from('simulations')
    .select('*, simulation_questions(count)')
    .order('area', { ascending: true })
  if (error) throw error
  return (data || []).map(s => ({
    ...s,
    questionCount: s.simulation_questions?.[0]?.count || 0,
  }))
}

export async function getSimulationWithQuestions(id) {
  const { data: sim, error } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: sqRows } = await supabase
    .from('simulation_questions')
    .select('position, questions(*)')
    .eq('simulation_id', id)
    .order('position', { ascending: true })

  return {
    ...sim,
    questions: (sqRows || []).map(r => ({ ...r.questions, position: r.position })),
  }
}

export async function createSimulation(simData, questionIds = []) {
  const { data: sim, error } = await supabase
    .from('simulations')
    .insert(simData)
    .select()
    .single()
  if (error) throw error

  if (questionIds.length > 0) {
    const rows = questionIds.map((qid, i) => ({
      simulation_id: sim.id,
      question_id: qid,
      position: i + 1,
    }))
    await supabase.from('simulation_questions').insert(rows)
  }
  return sim
}

export async function updateSimulation(id, data) {
  const { data: sim, error } = await supabase
    .from('simulations')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return sim
}

export async function deleteSimulation(id) {
  const { error } = await supabase.from('simulations').delete().eq('id', id)
  if (error) throw error
}

export async function reorderSimulationQuestions(simulationId, orderedQuestionIds) {
  const updates = orderedQuestionIds.map((qid, i) =>
    supabase
      .from('simulation_questions')
      .update({ position: i + 1 })
      .eq('simulation_id', simulationId)
      .eq('question_id', qid)
  )
  await Promise.all(updates)
}

export async function addQuestionToSimulation(simulationId, questionId) {
  const { data: existing } = await supabase
    .from('simulation_questions')
    .select('position')
    .eq('simulation_id', simulationId)
    .order('position', { ascending: false })
    .limit(1)

  const maxPosition = existing?.[0]?.position || 0
  const { error } = await supabase.from('simulation_questions').insert({
    simulation_id: simulationId,
    question_id: questionId,
    position: maxPosition + 1,
  })
  if (error) throw error
}

export async function removeQuestionFromSimulation(simulationId, questionId) {
  const { error } = await supabase
    .from('simulation_questions')
    .delete()
    .eq('simulation_id', simulationId)
    .eq('question_id', questionId)
  if (error) throw error
}

// ===== UTENTI =====

export async function getUsers({ premium, search, page = 0, pageSize = 50 } = {}) {
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (premium === true) query = query.eq('is_premium', true)
  if (premium === false) query = query.eq('is_premium', false)
  if (search) query = query.ilike('email', `%${search}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { data: data || [], count }
}

export async function getUserDetail(userId) {
  const [{ data: profile }, { data: progress }, { data: payments }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('quiz_progress').select('*, simulations(title)').eq('user_id', userId).order('saved_at', { ascending: false }),
    supabase.from('payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  return { profile, progress: progress || [], payments: payments || [] }
}

export async function setUserPremium(userId, isPremium) {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_premium: isPremium,
      premium_since: isPremium ? new Date().toISOString() : null,
    })
    .eq('id', userId)
  if (error) throw error
}

export async function setUserAdmin(userId, isAdmin) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId)
  if (error) throw error
}

export async function setUserBlocked(userId, isBlocked) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: isBlocked })
    .eq('id', userId)
  if (error) throw error
}

export async function deleteUser(userId) {
  if (!supabaseAdmin) throw new Error('Admin client non disponibile')
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) throw error
}
