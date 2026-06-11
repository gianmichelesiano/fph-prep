-- FPH Prep – Multi-area support for notebooks
-- Adds area_ids INTEGER[] column alongside existing area_id

ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS area_ids INTEGER[] DEFAULT '{}';

-- Populate area_ids from existing area_id for notebooks that have one
UPDATE public.notebooks SET area_ids = ARRAY[area_id] WHERE area_id IS NOT NULL AND array_length(area_ids, 1) IS NULL;

CREATE INDEX IF NOT EXISTS idx_notebooks_area_ids ON public.notebooks USING GIN (area_ids);
