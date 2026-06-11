-- ============================================================
-- FPH Prep – Role-based study: topics, user progress, area metadata
-- ============================================================

-- 1. Estendi aree con metadati ruolo
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS role_number INTEGER;
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS weight_percent INTEGER;
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS study_days INTEGER;
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS learning_objectives JSONB DEFAULT '[]';
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS description TEXT;

-- Aggiorna seed aree con metadati esame FPH
UPDATE public.areas SET role_number = 1, weight_percent = 7,  study_days = 2  WHERE id = 1;
UPDATE public.areas SET role_number = 2, weight_percent = 3,  study_days = 1  WHERE id = 2;
UPDATE public.areas SET role_number = 3, weight_percent = 3,  study_days = 1  WHERE id = 3;
UPDATE public.areas SET role_number = 4, weight_percent = 50, study_days = 15 WHERE id = 4;
UPDATE public.areas SET role_number = 5, weight_percent = 10, study_days = 3  WHERE id = 5;
UPDATE public.areas SET role_number = 6, weight_percent = 7,  study_days = 2  WHERE id = 6;
UPDATE public.areas SET role_number = 7, weight_percent = 7,  study_days = 2  WHERE id = 7;
UPDATE public.areas SET role_number = 8, weight_percent = 7,  study_days = 2  WHERE id = 8;
UPDATE public.areas SET role_number = 9, weight_percent = 7,  study_days = 2  WHERE id = 9;

-- 2. Tabella topics (sotto-argomenti per area)
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id INTEGER NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  learning_objectives JSONB DEFAULT '[]',
  source_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_area ON public.topics(area_id);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti leggono i topics"
  ON public.topics FOR SELECT
  USING (true);

CREATE POLICY "Admin gestisce topics"
  ON public.topics FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Collega domande a topic
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id);

-- 4. Progresso utente per area
CREATE TABLE IF NOT EXISTS public.user_area_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id INTEGER NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  questions_completed INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  avg_time_seconds FLOAT DEFAULT 0,
  last_quiz_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, area_id)
);

ALTER TABLE public.user_area_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti vedono il proprio progresso"
  ON public.user_area_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utenti aggiornano il proprio progresso"
  ON public.user_area_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin vede tutto il progresso"
  ON public.user_area_progress FOR SELECT
  TO authenticated
  USING (public.is_admin());
