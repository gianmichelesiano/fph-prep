-- ============================================================
-- FPH Prep – content_hash e expert_approved su questions
-- ============================================================

alter table public.questions add column if not exists content_hash text unique;
create index if not exists idx_questions_content_hash on public.questions(content_hash);

alter table public.questions add column if not exists expert_approved boolean default false;
