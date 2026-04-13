import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'fph_exam_progress'

export function useProgress() {
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} }
    catch { return {} }
  })
  const [user, setUser] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const saveTimer = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadFromSupabase(u.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) migrateAndLoad(u.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  async function loadFromSupabase(userId) {
    const { data, error } = await supabase
      .from('quiz_progress')
      .select('*')
      .eq('user_id', userId)
    if (error || !data) return

    const loaded = {}
    data.forEach(row => {
      loaded[row.test_id] = {
        status: row.status,
        score: row.score,
        total: row.total,
        answers: row.answers || {},
        currentIndex: row.current_index || 0,
        completedAt: row.completed_at,
        savedAt: row.saved_at,
      }
    })
    setProgress(loaded)
  }

  async function migrateAndLoad(userId) {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (Object.keys(local).length > 0) {
      for (const [testId, data] of Object.entries(local)) {
        if (uuidRegex.test(testId)) {
          await supabase.from('quiz_progress').upsert({
            user_id: userId,
            test_id: testId,
            status: data.status,
            answers: data.answers || {},
            current_index: data.currentIndex || 0,
            score: data.score,
            total: data.total,
            completed_at: data.completedAt || null,
            saved_at: data.savedAt || new Date().toISOString(),
          }, { onConflict: 'user_id,test_id' })
        }
      }
    }
    loadFromSupabase(userId)
  }

  async function saveToSupabase(testId, data) {
    if (!user) return
    setSyncStatus('saving')
    const { error } = await supabase.from('quiz_progress').upsert({
      user_id: user.id,
      test_id: testId,
      status: data.status,
      answers: data.answers || {},
      current_index: data.currentIndex || 0,
      score: data.score,
      total: data.total,
      completed_at: data.completedAt || null,
      saved_at: new Date().toISOString(),
    }, { onConflict: 'user_id,test_id' })

    if (error) { setSyncStatus('error'); return }
    setSyncStatus('saved')
    setTimeout(() => setSyncStatus('idle'), 2000)
  }

  function saveResult(testId, result) {
    const data = { ...result, completedAt: new Date().toISOString() }
    setProgress(prev => ({ ...prev, [testId]: data }))
    saveToSupabase(testId, data)
  }

  function savePartial(testId, answers, currentIndex) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setProgress(prev => {
      const data = { ...prev[testId], status: 'in_progress', answers, currentIndex, savedAt: new Date().toISOString() }
      saveTimer.current = setTimeout(() => saveToSupabase(testId, data), 5000)
      return { ...prev, [testId]: data }
    })
  }

  function clearResult(testId) {
    setProgress(prev => { const next = { ...prev }; delete next[testId]; return next })
    if (user) {
      supabase.from('quiz_progress').delete().eq('user_id', user.id).eq('test_id', testId)
    }
  }

  return { progress, saveResult, savePartial, clearResult, syncStatus }
}
