-- ============================================================
-- FPH Prep – Tabella aree (ruoli)
-- ============================================================

create table public.areas (
  id integer primary key check (id between 1 and 9),
  name text not null,
  name_de text,
  name_fr text,
  name_en text,
  questions_count integer default 0,
  color_class text
);

-- RLS
alter table public.areas enable row level security;

create policy "Tutti leggono le aree"
  on public.areas for select
  using (true);

create policy "Admin gestisce le aree"
  on public.areas for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Dati
insert into public.areas (id, name, questions_count, color_class) values
  (1, 'Validazione ricette',      7,  'bg-primary/10 text-primary'),
  (2, 'Fitoterapia',              3,  'bg-tertiary/10 text-tertiary'),
  (3, 'Medicina complementare',   3,  'bg-secondary/10 text-secondary'),
  (4, 'Farmacia Clinica',         50, 'bg-primary-container/20 text-primary-container'),
  (5, 'Anamnesi e terapia',       10, 'bg-primary/10 text-primary'),
  (6, 'Preparazione medicinali',  7,  'bg-tertiary/15 text-tertiary'),
  (7, 'Risultati di laboratorio', 7,  'bg-secondary-container text-on-secondary-container'),
  (8, 'Situazioni d''emergenza',  7,  'bg-error-container text-error'),
  (9, 'Vaccinazioni e prelievi',  7,  'bg-primary-fixed/30 text-on-primary-fixed');

-- Foreign key su questions e simulations
alter table public.questions
  add constraint fk_questions_area foreign key (area) references public.areas(id);

alter table public.simulations
  add constraint fk_simulations_area foreign key (area) references public.areas(id);
