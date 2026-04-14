import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { saveSessionProgress, completeSession, markQuestionsSeen } from '../lib/api'

const SAVE_DELAY = 5000 // salva ogni 5 secondi di inattività

export function useSession(sessionId) {
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [syncStatus, setSyncStatus] = useState('idle')
  const saveTimer = useRef(null)

  function answerQuestion(questionId, answer) {
    const nextAnswers = { ...answers, [questionId]: answer }
    setAnswers(nextAnswers)

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persistProgress(nextAnswers, currentIndex)
    }, SAVE_DELAY)
  }

  function goToIndex(index) {
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

    // Calcola score
    let score = 0
    const total = questions.length
    for (const q of questions) {
      const userAnswer = answers[q.id]
      if (q.type === 'multiple_choice') {
        if (userAnswer === q.correct_answer) score++
      } else {
        // kprim: correct_answer = "VFFV", userAnswer = "VFFV"
        if (userAnswer === q.correct_answer) score++
      }
    }

    await completeSession(sessionId, answers, score, total)

    // Traccia domande viste
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await markQuestionsSeen(user.id, questions.map(q => q.id))
    }

    return { score, total }
  }

  return { answers, currentIndex, syncStatus, answerQuestion, goToIndex, finish }
}
