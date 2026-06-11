-- Aggiunge question_ids alle simulazioni (lista pre-selezionata al momento del salvataggio)
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS question_ids uuid[] DEFAULT '{}';
