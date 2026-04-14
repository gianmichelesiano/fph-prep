# Simulations Schema Redesign — Design Spec (Sub-progetto 1)

## Overview

Redesign del sistema di simulazioni: da simulazioni pre-costruite con domande fisse a un modello template + sessione dinamica. Le domande vengono pescate al volo ad ogni avvio, privilegiando quelle non ancora viste dall'utente.

## Migration Plan

### Step 1 — Pulizia dati esistenti
```sql
-- Cancella tutte le simulazioni storiche (cascade su simulation_questions)
DELETE FROM public.simulations;

-- Drop tabella quiz_progress (sostituita da quiz_sessions)
DROP TABLE IF EXISTS public.quiz_progress;

-- Drop tabella simulation_questions (non più necessaria)
DROP TABLE IF EXISTS public.simulation_questions;
```

### Step 2 — Alter simulations

Aggiungere colonne al template:

```sql
-- Tipo di simulazione
ALTER TABLE public.simulations
  ADD COLUMN type text NOT NULL DEFAULT 'custom'
    CHECK (type IN ('exam', 'custom'));

-- Configurazione aree: { "1": 7, "2": 3, ... }
ALTER TABLE public.simulations
  ADD COLUMN area_config jsonb NOT NULL DEFAULT '{}';

-- Rimuovere legacy_id (non più necessario)
ALTER TABLE public.simulations DROP COLUMN IF EXISTS legacy_id;
```

La tabella `simulations` finale:
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | generato |
| `title` | text | nome del template |
| `type` | text | `exam` \| `custom` |
| `area_config` | jsonb | `{"1":7,"2":3,...}` |
| `timer` | integer | minuti (210 per exam) |
| `lang` | text | `it`\|`de`\|`fr`\|`en` |
| `is_free` | boolean | accesso senza premium |
| `status` | text | `draft`\|`active`\|`archived` |
| `created_at` | timestamptz | |

### Step 3 — Nuova tabella quiz_sessions

```sql
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
```

### Step 4 — Nuova tabella user_question_history

```sql
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

## Area Config — Schema Fisso Esame

Per `type = 'exam'` la `area_config` è sempre:
```json
{"1":7,"2":3,"3":3,"4":50,"5":10,"6":7,"7":3,"8":7,"9":7,"10":3}
```
Totale: 100 domande, timer: 210 minuti.

Per `type = 'custom'` l'admin definisce liberamente la distribuzione (max 100 domande totali).

## Algoritmo Pick Domande (al momento dell'avvio sessione)

Per ogni area N con count C definiti in `area_config`:
1. Prendi tutte le domande `active` con `area = N`
2. Ordina: prima quelle **non presenti** in `user_question_history` per quell'utente, poi random
3. Prendi le prime C
4. Se non ci sono abbastanza domande, prendi tutte quelle disponibili

Risultato: array ordinato di `question_ids` salvato in `quiz_sessions.question_ids`.

## File Migration

`supabase/migrations/005_simulations_redesign.sql` — contiene tutti gli step sopra in sequenza.

## Impatto sul codice esistente

- `src/lib/api.js` — `fetchSimulation`, `fetchSimulations`, `fetchSimulationQuestions` vanno riscritti
- `src/lib/adminApi.js` — funzioni simulazioni vanno aggiornate
- `src/pages/Quiz.jsx` — legge da `quiz_sessions` invece di `quiz_progress`
- `src/pages/Results.jsx` — legge da `quiz_sessions`
- `src/pages/Stats.jsx` — legge da `quiz_sessions`
- `src/pages/admin/Simulations.jsx` — redesign completo (Sub-progetto 2)
- `src/pages/admin/SimulationEditor.jsx` — redesign completo (Sub-progetto 2)
