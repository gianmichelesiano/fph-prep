alter table public.artifacts drop constraint if exists artifacts_type_check;
alter table public.artifacts add constraint artifacts_type_check
  check (type in ('summary','quiz','iconography','study_guide','flashcards'));

alter table public.generation_jobs drop constraint if exists generation_jobs_type_check;
alter table public.generation_jobs add constraint generation_jobs_type_check
  check (type in ('summary','quiz','iconography','study_guide','flashcards'));
