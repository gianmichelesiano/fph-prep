# Simulations Schema Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrare il sistema di simulazioni dal modello pre-costruito al modello template + sessione dinamica, aggiornando schema DB e layer API senza rompere l'app.

**Architecture:** Migration SQL eseguita manualmente nel dashboard Supabase. Poi aggiornamento di `api.js`, `adminApi.js` e `useProgress.js` per usare le nuove tabelle `quiz_sessions` e `user_question_history`. Le pagine Quiz/Results/Stats continuano a funzionare tramite il nuovo hook `useSession.js`.

**Tech Stack:** Supabase (PostgreSQL), React, `@supabase/supabase-js`

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/005_simulations_redesign.sql`

- [ ] **Step 1: Creare il file migration**

```sql
-- ============================================================
-- FPH Prep – Simulations redesign: template + session model
-- ============================================================

-- 1. Pulizia dati esistenti
DELETE FROM public.simulations;
DROP TABLE IF EXISTS public.simulation_questions;
DROP TABLE IF EXISTS public.quiz_progress;

-- 2. Alter simulations: aggiungi type e area_config, rimuovi legacy_id
ALTER TABLE public.simulations DROP COLUMN IF EXISTS legacy_id;

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'custom'
    CHECK (type IN ('exam', 'custom'));

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS area_config jsonb NOT NULL DEFAULT '{}';

-- 3. Nuova tabella quiz_sessions
CREATE TABLE public.quiz_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  simulation_id uuid REFERENCES public.simulations(id) ON DELETE CASCADE NOT NULL,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  answers jsonb NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  score numeric,
  total numeric,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti gestiscono le proprie sessioni"
  ON public.quiz_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admin vede tutte le sessioni"
  ON public.quiz_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_quiz_sessions_user ON public.quiz_sessions(user_id);
CREATE INDEX idx_quiz_sessions_sim ON public.quiz_sessions(simulation_id);
CREATE INDEX idx_quiz_sessions_status ON public.quiz_sessions(status);

-- 4. Nuova tabella user_question_history
CREATE TABLE public.user_question_history (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  seen_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti vedono la propria storia"
  ON public.user_question_history FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_uqh_user ON public.user_question_history(user_id);
CREATE INDEX idx_uqh_question ON public.user_question_history(question_id);
```

- [ ] **Step 2: Eseguire nel Supabase Dashboard → SQL Editor**

Copia il contenuto e incollalo nel SQL Editor. Esegui. Deve completare senza errori.

Verifica nel Table Editor:
- `simulations` ha colonne `type` e `area_config` (e non ha più `legacy_id`)
- `quiz_sessions` esiste con le colonne corrette
- `user_question_history` esiste
- `simulation_questions` e `quiz_progress` non esistono più

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_simulations_redesign.sql
git commit -m "feat: add simulations redesign migration SQL"
```

---

### Task 2: Riscrivere src/lib/api.js

**Files:**
- Modify: `src/lib/api.js`

`api.js` attuale ha funzioni che usano `simulation_questions` (tabella eliminata). Va riscritto per usare il nuovo schema.

- [ ] **Step 1: Sostituire tutto il contenuto di `src/lib/api.js`**

```js
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

export async function completeSession(sessionId, answers, score, total, questionIds) {
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
```

- [ ] **Step 2: Verificare che il file non abbia errori di sintassi**

```bash
node --input-type=module < src/lib/api.js 2>&1 | head -5
```

Expected: errore su import (normale, non è un file standalone) ma nessun SyntaxError.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.js
git commit -m "feat: rewrite api.js for new session-based simulation model"
```

---

### Task 3: Aggiornare adminApi.js

**Files:**
- Modify: `src/lib/adminApi.js`

Rimuovere tutti i riferimenti a `simulation_questions` e `quiz_progress`, aggiornarli con `quiz_sessions`.

- [ ] **Step 1: Aggiornare `getStats()` — sostituire quiz_progress con quiz_sessions**

Trovare la funzione `getStats` (righe 5-25) e sostituirla:

```js
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
    supabase.from('quiz_sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('payments').select('amount').eq('status', 'completed'),
    supabase.from('quiz_sessions').select('score, total').eq('status', 'completed'),
  ])

  const totalRevenue = (revenueData || []).reduce((sum, p) => sum + (p.amount || 0), 0) / 100
  const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0
  const passedQuizzes = (scoreData || []).filter(r => r.total > 0 && (r.score / r.total) >= 0.67).length

  return { totalUsers, premiumUsers, completedQuizzes, totalRevenue, conversionRate, passedQuizzes }
}
```

- [ ] **Step 2: Aggiornare `getRecentActivity()` — sostituire quiz_progress con quiz_sessions**

Trovare `getRecentActivity` e sostituirla:

```js
export async function getRecentActivity(limit = 5) {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('user_id, started_at, score, total, profiles(full_name, email)')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data || []).map(row => {
    const name = row.profiles?.full_name || row.profiles?.email?.split('@')[0] || 'User'
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    const pct = row.total > 0 ? Math.round((row.score / row.total) * 100) : 0
    return { name, initials, action: 'Test Completed', status: pct >= 67 ? 'PASSED' : 'COMPLETED', time: row.started_at }
  })
}
```

- [ ] **Step 3: Aggiornare `getUserDetail()` — sostituire quiz_progress con quiz_sessions**

Trovare `getUserDetail` e sostituire la riga con `quiz_progress`:

```js
export async function getUserDetail(userId) {
  const [{ data: profile }, { data: progress }, { data: payments }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('quiz_sessions').select('*, simulations(title)').eq('user_id', userId).order('started_at', { ascending: false }),
    supabase.from('payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  return { profile, progress: progress || [], payments: payments || [] }
}
```

- [ ] **Step 4: Aggiornare le funzioni simulazioni — rimuovere simulation_questions**

Sostituire `getAllSimulations`, `getSimulationWithQuestions`, `createSimulation`, `updateSimulation`, `deleteSimulation` e rimuovere `reorderSimulationQuestions`, `addQuestionToSimulation`, `removeQuestionFromSimulation` (non più necessarie):

```js
// ===== SIMULAZIONI =====

export async function getAllSimulations() {
  const { data, error } = await supabase
    .from('simulations')
    .select('*, quiz_sessions(count)')
    .order('type', { ascending: true })
    .order('title', { ascending: true })
  if (error) throw error
  return (data || []).map(s => ({
    ...s,
    sessionCount: s.quiz_sessions?.[0]?.count || 0,
  }))
}

export async function createSimulation(data) {
  const { data: sim, error } = await supabase
    .from('simulations')
    .insert(data)
    .select()
    .single()
  if (error) throw error
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
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminApi.js
git commit -m "feat: update adminApi.js to use quiz_sessions, remove simulation_questions refs"
```

---

### Task 4: Riscrivere src/hooks/useProgress.js → useSession.js

**Files:**
- Create: `src/hooks/useSession.js`
- The old `useProgress.js` remains but non viene più usato attivamente (verrà rimosso in Sub-progetto 3)

- [ ] **Step 1: Creare `src/hooks/useSession.js`**

```js
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
    let total = questions.length
    for (const q of questions) {
      const userAnswer = answers[q.id]
      if (q.type === 'multiple_choice') {
        if (userAnswer === q.correct_answer) score++
      } else {
        // kprim: correct_answer = "VFFV", userAnswer = "VFFV"
        if (userAnswer === q.correct_answer) score++
      }
    }

    await completeSession(sessionId, answers, score, total, questions.map(q => q.id))

    // Traccia domande viste
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await markQuestionsSeen(user.id, questions.map(q => q.id))
    }

    return { score, total }
  }

  return { answers, currentIndex, syncStatus, answerQuestion, goToIndex, finish }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSession.js
git commit -m "feat: add useSession hook for new quiz_sessions model"
```
