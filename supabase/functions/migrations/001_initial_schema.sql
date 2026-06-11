-- ============================================================
-- FPH Prep – Schema iniziale
-- Eseguire nel Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== TABELLE =====

create table public.profiles (
  id uuid references auth.users primary key,
  email text,
  full_name text,
  is_premium boolean default false,
  is_admin boolean default false,
  preferred_lang text default 'de',
  premium_since timestamptz,
  stripe_customer_id text,
  created_at timestamptz default now()
);

create table public.questions (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  type text not null check (type in ('multiple_choice', 'kprim')),
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  area integer not null check (area between 1 and 9),
  topic text,
  lang text default 'de' check (lang in ('it', 'de', 'fr', 'en')),
  status text default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.simulations (
  id uuid default gen_random_uuid() primary key,
  legacy_id text unique,
  title text not null,
  area integer check (area between 1 and 9),
  timer integer default 210,
  lang text default 'de' check (lang in ('it', 'de', 'fr', 'en')),
  is_free boolean default false,
  status text default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz default now()
);

create table public.simulation_questions (
  simulation_id uuid references public.simulations(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  position integer not null,
  primary key (simulation_id, question_id)
);

create table public.quiz_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  test_id uuid references public.simulations(id) on delete cascade,
  status text check (status in ('in_progress', 'completed')),
  answers jsonb default '{}',
  current_index int default 0,
  score numeric,
  total numeric,
  completed_at timestamptz,
  saved_at timestamptz default now(),
  unique(user_id, test_id)
);

create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  stripe_session_id text unique,
  amount integer,
  currency text default 'chf',
  status text,
  created_at timestamptz default now()
);

-- ===== HELPER: controlla se l'utente corrente è admin =====
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- ===== TRIGGER: crea profilo automaticamente dopo registrazione =====
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===== TRIGGER: aggiorna updated_at su questions =====
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger questions_updated_at
  before update on public.questions
  for each row execute procedure public.update_updated_at();

-- ===== ABILITA RLS =====
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_questions enable row level security;
alter table public.quiz_progress enable row level security;
alter table public.payments enable row level security;

-- ===== RLS: profiles =====
create policy "Utenti vedono il proprio profilo"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Utenti modificano il proprio profilo"
  on public.profiles for update
  using (auth.uid() = id);

-- ===== RLS: questions =====
create policy "Autenticati leggono domande attive"
  on public.questions for select
  to authenticated
  using (status = 'active' or public.is_admin());

create policy "Admin inserisce domande"
  on public.questions for insert
  to authenticated
  with check (public.is_admin());

create policy "Admin modifica domande"
  on public.questions for update
  to authenticated
  using (public.is_admin());

create policy "Admin elimina domande"
  on public.questions for delete
  to authenticated
  using (public.is_admin());

-- ===== RLS: simulations =====
create policy "Autenticati leggono simulazioni attive"
  on public.simulations for select
  to authenticated
  using (status = 'active' or public.is_admin());

create policy "Admin gestisce simulazioni"
  on public.simulations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== RLS: simulation_questions =====
create policy "Autenticati leggono simulation_questions"
  on public.simulation_questions for select
  to authenticated
  using (true);

create policy "Admin gestisce simulation_questions"
  on public.simulation_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== RLS: quiz_progress =====
create policy "Utenti gestiscono il proprio progresso"
  on public.quiz_progress for all
  using (auth.uid() = user_id);

create policy "Admin vede tutto il progresso"
  on public.quiz_progress for select
  to authenticated
  using (public.is_admin());

-- ===== RLS: payments =====
create policy "Utenti vedono i propri pagamenti"
  on public.payments for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Service role inserisce pagamenti"
  on public.payments for insert
  with check (true);

-- ===== INDICI =====
create index idx_questions_area on public.questions(area);
create index idx_questions_status on public.questions(status);
create index idx_questions_lang on public.questions(lang);
create index idx_simulations_status on public.simulations(status);
create index idx_simulations_lang on public.simulations(lang);
create index idx_quiz_progress_user on public.quiz_progress(user_id);
create index idx_simulation_questions_sim on public.simulation_questions(simulation_id);

-- ===== NOTA FINALE =====
-- Dopo aver eseguito questo schema, imposta te stesso come admin:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'tua@email.com';
