-- ============================================================
-- FPH Prep – notebook_contents (riassunti di studio)
-- ============================================================

create table public.notebook_contents (
  id uuid default gen_random_uuid() primary key,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  lang text not null default 'it' check (lang in ('it','de','fr','en')),
  content_md text not null,
  is_free boolean default false,
  source_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (notebook_id, lang)
);

create index idx_notebook_contents_notebook on public.notebook_contents(notebook_id);

alter table public.notebook_contents enable row level security;

-- Lettura: riga free visibile a chiunque autenticato;
-- riga non-free visibile solo a utenti premium o admin.
create policy "read_free_or_premium"
  on public.notebook_contents for select
  to authenticated
  using (
    is_free = true
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_premium = true or profiles.is_admin = true)
    )
  );

-- Write / update / delete: solo admin
create policy "admin_write"
  on public.notebook_contents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
