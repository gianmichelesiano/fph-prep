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
