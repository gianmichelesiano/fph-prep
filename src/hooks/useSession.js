import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { saveSessionProgress, completeSession, markQuestionsSeen } from '../lib/api'

const SAVE_DELAY = 5000 // salva ogni 5 secondi di inattività

export function useSession(sessionId) {
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [syncStatus, setSyncStatus] = useState('idle')
  const saveTimer = useRef(null)

  // Refs per avere sempre i valori aggiornati nelle callback async
  const answersRef = useRef({})
  const currentIndexRef = useRef(0)

  function restoreState(savedAnswers, savedIndex) {
    answersRef.current = savedAnswers || {}
    currentIndexRef.current = savedIndex || 0
    setAnswers(answersRef.current)
    setCurrentIndex(currentIndexRef.current)
  }

  function answerQuestion(questionId, answer) {
    const nextAnswers = { ...answersRef.current, [questionId]: answer }
    answersRef.current = nextAnswers
    setAnswers(nextAnswers)

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persistProgress(nextAnswers, currentIndexRef.current)
    }, SAVE_DELAY)
  }

  function goToIndex(index) {
    currentIndexRef.current = index
    setCurrentIndex(index)
  }

  async function persistProgress(currentAnswers, index) {
    if (!sessionId) return
    setSyncStatus('saving')
    try {
      await saveSessionProgress(sessionId, currentAnswers, index)
      setSyncStatus('saved')
      setTimeout(() => setSyncStatus('idle'), 2000)
    } catch {
      setSyncStatus('error')
    }
  }

  async function finish(questions) {
    if (!sessionId) return

    const currentAnswers = answersRef.current
    let score = 0
    const total = questions.length
    for (const q of questions) {
      const userAnswer = currentAnswers[q.id]
      if (q.type === 'multiple') {
        if (userAnswer === q.correct) score++
      } else {
        const ua = userAnswer || {}
        const allCorrect = q.items.every((item, i) => ua[i] === item.correct)
        const oneWrong = q.items.filter((item, i) => ua[i] !== item.correct).length === 1
        if (allCorrect) score += 1
        else if (oneWrong) score += 0.5
      }
    }

    await completeSession(sessionId, currentAnswers, score, total)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await markQuestionsSeen(user.id, questions.map(q => q.id))
    }

    return { score, total }
  }

  async function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await persistProgress(answersRef.current, currentIndexRef.current)
  }

  return { answers, currentIndex, syncStatus, answerQuestion, goToIndex, finish, saveNow, restoreState }
}
