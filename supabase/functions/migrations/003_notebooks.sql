-- ============================================================
-- FPH Prep – Area 10 + Tabella notebooks
-- ============================================================

-- ===== Aggiorna check constraint per supportare area 10 =====
alter table public.areas drop constraint areas_id_check;
alter table public.areas add constraint areas_id_check check (id between 1 and 10);

alter table public.questions drop constraint questions_area_check;
alter table public.questions add constraint questions_area_check check (area between 1 and 10);

alter table public.simulations drop constraint simulations_area_check;
alter table public.simulations add constraint simulations_area_check check (area between 1 and 10);

-- ===== Aggiunge area 10 =====
insert into public.areas (id, name, questions_count, color_class) values
  (10, 'Altro', 0, 'bg-surface-container-high text-on-surface-variant');

-- ===== Tabella notebooks =====
create table public.notebooks (
  id uuid primary key,           -- UUID NotebookLM
  key text unique,               -- chiave in notebooks.yaml (es. "fitoterapia")
  title text not null,           -- titolo nel NotebookLM
  area_id integer references public.areas(id),
  argomento text,                -- argomenti coperti (da notebooks.yaml)
  active boolean default true,
  created_at date
);

-- RLS
alter table public.notebooks enable row level security;

create policy "Tutti leggono i notebook"
  on public.notebooks for select
  using (true);

create policy "Admin gestisce i notebook"
  on public.notebooks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Dati notebooks =====
insert into public.notebooks (id, key, title, area_id, argomento, created_at) values

  -- Area 1 – Validazione ricette
  ('282ed964-3d87-4bae-93de-85564284987b', 'interazioni',     'Interazioni rilevanti',           1, 'interazioni farmacologiche rilevanti, polifarmacia, validazione ricette, controindicazioni, dosaggio',                                                        '2026-04-10'),
  ('c81f90ff-c112-4591-a663-15d4ef62f2c9', 'deprescrizione',  'Deprescrizione farmaci',           1, 'deprescrizione, polifarmacia nell''anziano, criteri STOPP/START, revisione terapia, sospensione sicura',                                                    '2026-04-10'),
  ('620f2e4d-2169-4803-9611-f9413098d586', 'lista_b',         'Lista B',                          1, 'farmaci Lista B, dispensazione su prescrizione medica, categorie di dispensazione svizzere, obbligo di ricetta',                                             '2026-04-10'),

  -- Area 2 – Fitoterapia
  ('488318a6-e0c7-47d7-852e-79f4bde754e9', 'fitoterapia',     'Fitoterapia',                      2, 'piante medicinali, estratti vegetali, interazioni piante-farmaci, efficacia fitoterapici, legislazione svizzera',                                            '2026-04-10'),
  ('4023d36b-387e-4433-aea2-ed22e50b62c4', 'fitoterapia_b',   'Fitoterapia (approfondimento)',     2, 'fitoterapici in farmacia, adattogeni, rimedi erboristici, controindicazioni, consiglio al banco',                                                           '2026-04-10'),

  -- Area 3 – Medicina complementare
  ('278c368e-b885-4858-a34d-a2df31683080', 'omeopatia',       'Omeopatia',                        3, 'omeopatia, potenze omeopatiche, metodo omeopatico, antroposofia, medicina complementare in farmacia',                                                       '2026-04-10'),

  -- Area 4 – Farmacia Clinica
  ('692dbd5d-7dad-4d78-9d0f-03a765c23612', 'respiratorie',           'Malattie respiratorie',                    4, 'asma, BPCO, rinite allergica, farmaci inalatori, SABA, LABA, ICS, ARIA, GOLD',                                                             '2026-04-10'),
  ('67fbff31-1749-4c9f-8b47-09986e1dd102', 'respiratorie_bambini',   'Malattie respiratorie pediatriche',        4, 'asma nei bambini, bronchiolite, croup, laringite, dosaggi pediatrici, immunologia respiratoria',                                            '2026-04-10'),
  ('9f80ddf6-d5bc-4940-a146-4f497f045148', 'cardio',                 'Sistema cardiocircolatorio',               4, 'ipertensione, scompenso cardiaco, DOAC, anticoagulanti, statine, antiaggreganti, aritmia, SGLT2',                                           '2026-04-10'),
  ('b4a70a09-cd67-48db-a015-8310294d1d59', 'dolore',                 'Dolore',                                   4, 'dolore acuto e cronico, oppioidi, FANS, paracetamolo, scala analgesica OMS, dolore neuropatico',                                             '2026-04-10'),
  ('9ecb9092-02d7-40a8-b54d-333ab09cedef', 'pelle',                  'Malattie della pelle',                     4, 'dermatite atopica, eczema, dermatomicosi, dermocorticoidi, prurito, xerosi cutanea, trattamento topico',                                    '2026-04-10'),
  ('07bb26c1-dddf-41f3-9c2c-2e57e8f17e1e', 'pelle_bambini',          'Malattie esantematiche e pelle bambini',   4, 'malattie esantematiche infantili, varicella, morbillo, scarlattina, dermatite da pannolino, eczema pediatrico',                             '2026-04-10'),
  ('ea036cfb-781f-4b4a-af67-a150e73ceb6b', 'intestino',              'Malattie intestinali',                     4, 'Crohn, colite ulcerosa, IBS, lassativi, diarrea, stipsi, malattie infiammatorie intestinali, microbiota',                                   '2026-04-10'),
  ('81d0837b-5fbf-45db-b78d-ffe0d251da50', 'reflusso',               'Reflusso',                                 4, 'reflusso GERD, dispepsia, PPI, antiacidi, H. pylori, FANS e gastroprotezione, regime dietetico',                                            '2026-04-10'),
  ('c8983089-7363-49f7-aa8b-1be893b7e0c2', 'fegato',                 'Malattie del fegato',                      4, 'epatite, cirrosi epatica, steatosi epatica, danno epatico da farmaci, valori laboratorio epatici',                                          '2026-04-10'),
  ('42b58b26-4e6d-4445-a5d7-d90c9beab97b', 'allergie',               'Allergie stagionali',                      4, 'allergie stagionali, rinite allergica, antiistaminici, polline, congiuntivite allergica, desensibilizzazione',                               '2026-04-10'),
  ('4294841b-fa72-46a0-a75b-c018bff9f037', 'antibiotici',            'Antibiotici',                              4, 'antibiotici, penicilline, cefalosporine, macrolidi, fluorochinoloni, resistenze batteriche, stewardship antibiotica',                        '2026-04-10'),
  ('2904e777-4394-40ce-9afc-6d03a5eb7b19', 'acne_rosacea',           'Acne e Rosacea',                           4, 'acne vulgaris, rosacea, retinoidi topici, benzoile perossido, antibiotici topici, isotretinoina',                                           '2026-04-10'),
  ('798b647a-d956-4efb-b707-ec39ce932fb0', 'psoriasi',               'Psoriasi',                                 4, 'psoriasi a placche, psoriasi ungueale, analoghi vitamina D topici, corticosteroidi, biologici',                                             '2026-04-10'),
  ('7a6340f7-11cc-4229-87d7-7c7232838a9a', 'micosi',                 'Micosi',                                   4, 'micosi cutanee, tinea pedis, tinea unguium, candidiasi, antifungini topici e sistemici',                                                    '2026-04-10'),
  ('120abcf9-b4f4-42ab-bd2c-33cde6d7789b', 'ferite',                 'Cura delle ferite',                        4, 'cura delle ferite, medicazioni, antisettici, cicatrizzanti, ferite croniche, gestione lesioni cutanee',                                      '2026-04-10'),
  ('12ad9068-c413-4a9b-a976-d5ddfb7db13d', 'diabete',                'Diabete e malattie metaboliche',           4, 'diabete tipo 1 e 2, insuline, metformina, SGLT2, GLP-1, monitoraggio glicemia, HbA1c, ipoglicemia, obesità',                               '2026-04-10'),
  ('b960f401-24bf-49a7-83ae-8a0c01027dda', 'osteoporosi',            'Osteoporosi',                              4, 'osteoporosi, bifosfonati, calcio e vitamina D, RANK-L inibitori, rischio frattura, FRAX',                                                  '2026-03-27'),
  ('3adb2f97-b846-4b84-b64e-126272cc35cc', 'neurologia',             'Patologie neuronali',                      4, 'Parkinson, epilessia, sclerosi multipla, antiepilettici, demenza, Alzheimer, farmaci neurologici',                                          '2026-04-10'),
  ('b087dabe-edaa-4cfa-809a-a726b25ec588', 'psichiatria',            'Ansia, stress e disturbi psichiatrici',    4, 'depressione, ansia, disturbi psichiatrici, SSRI, SNRI, benzodiazepine, antipsicotici',                                                     '2026-04-10'),
  ('9d7454a0-2893-4bc9-8615-70c135291e29', 'emicrania',              'Emicrania',                                4, 'emicrania, cefalea tensiva, triptani, profilassi emicrania, FANS, ergotamina',                                                              '2026-04-10'),
  ('bbf80ff0-9f2d-415f-84e1-71d45ed4d556', 'disturbi_sonno',         'Disturbi del sonno',                       4, 'insonnia, disturbi del sonno, ipnotici, melatonina, igiene del sonno, dipendenza da benzodiazepine',                                        '2026-04-10'),
  ('660b6082-a59f-47ef-a593-f997fccbbb46', 'nausea',                 'Nausea e vomito',                          4, 'nausea e vomito, antiemetici, cinetosi, nausea in gravidanza, metoclopramide, ondansetron',                                                 '2026-04-10'),
  ('aa30d50e-44be-44ee-9318-5c3391cbed62', 'reumatologia',           'Reumatologia',                             4, 'artrite reumatoide, gotta, FANS, DMARDs, artrite psoriasica, dolore articolare',                                                           '2026-04-10'),
  ('2ce6046c-51bd-46a4-98f4-da76152d4da1', 'gravidanza',             'Gravidanza e allattamento',                4, 'farmaci in gravidanza, categorie FDA, lattazione, acido folico, ferro, vitamina D, farmaci controindicati',                                 '2026-04-10'),
  ('f395f0e5-da6e-4234-b367-7b56249229bf', 'menopausa',              'Mestruazioni e menopausa',                 4, 'menopausa, terapia ormonale sostitutiva, fitoestrogeni, sintomi menopausali, osteoporosi postmenopausale',                                  '2026-04-10'),
  ('5020b133-2157-4d37-9580-0cfeec726e26', 'contraccezione',         'Contraccezione d''emergenza',              4, 'contraccezione d''emergenza, pillola del giorno dopo, ulipristal, levonorgestrel, finestra temporale',                                     '2026-04-10'),
  ('6fcaeff1-2d8d-48db-addb-77d4efaaedbc', 'endometriosi',           'Endometriosi',                             4, 'endometriosi, terapia ormonale, dolore pelvico cronico, diagnosi, trattamento farmacologico',                                              '2026-04-10'),
  ('9bb474bb-c4e0-45e4-9af1-2bc80a75655a', 'vaginali',               'Disturbi vaginali',                        4, 'vaginosi batterica, candida vaginale, tricomoniasi, secchezza vaginale, probiotici ginecologici',                                          '2026-04-10'),
  ('ffaa51d1-81c5-4768-85e8-028f665e3556', 'vescica',                'Infezioni vescica e reni',                 4, 'cistite, infezioni vie urinarie, pielonefrite, uroantisettici, terapia antibiotica UTI',                                                   '2026-04-10'),
  ('51c7ad60-c282-4df6-bc31-f2bc1c6f7af4', 'urogenitale',            'Urogenitale',                              4, 'ipertrofia prostatica benigna, alfabloccanti, inibitori 5-alfa reduttasi, incontinenza urinaria',                                          '2026-04-10'),
  ('d643210c-46af-426b-8db2-c600b1d8146d', 'erettile',               'Disfunzione erettile',                     4, 'disfunzione erettile, PDE5 inibitori, sildenafil, tadalafil, controindicazioni con nitrati',                                              '2026-04-10'),
  ('ffc310b7-d033-485c-9c38-902d462637aa', 'mst',                    'Malattie sessualmente trasmissibili',      4, 'gonorrea, sifilide, chlamydia, herpes genitale, HIV, profilassi PrEP',                                                                    '2026-04-10'),
  ('40322deb-c3f3-48df-ab3c-afc57296566f', 'cancro_seno',            'Cancro al seno',                           4, 'cancro al seno, ormonoterapia, tamoxifene, inibitori aromatasi, screening mammografico',                                                   '2026-04-10'),
  ('c6060555-f3ec-400e-8a1d-1be57f720253', 'oculari',                'Infezioni oculari',                        4, 'congiuntivite batterica e virale, collirio antibiotico, secchezza oculare, glaucoma, red flags oculari',                                   '2026-04-10'),
  ('d6f72416-57a7-4cc9-bdcf-d8eea6e900c8', 'otoscopia',              'Otoscopia',                                4, 'otite esterna, otite media, cerume, otoscopia in farmacia, gocce auricolari',                                                             '2026-04-10'),
  ('782184ae-14c7-4700-9e17-f19db4984b0f', 'insetti',                'Insetti e parassiti',                      4, 'pediculosi, scabbia, punture di insetti, repellenti, permectrina, ivermectina',                                                           '2026-04-10'),
  ('44ce4ea9-583b-4b17-a248-469b6f16a754', 'zecche',                 'Zecche parassiti e insetti',               4, 'zecche, malattia di Lyme, TBE, profilassi antibiotica post-morso, rimozione zecca, vaccino TBE',                                         '2026-04-10'),
  ('ab37319d-1f5c-4a66-9adc-d35732963519', 'viaggi',                 'Viaggi e Malaria',                         4, 'viaggi tropicali, profilassi malaria, vaccini per viaggiatori, diarrea del viaggiatore, repellenti',                                      '2026-04-10'),
  ('e6a3cffd-7910-4247-b2f2-fa290fcafc03', 'fumo',                   'Smettere di fumare',                       4, 'cessazione fumo, NRT nicotina, vareniclina, bupropione, motivazione al banco, dipendenza nicotinica',                                      '2026-04-10'),

  -- Area 5 – Anamnesi e terapia
  ('e76a358e-66da-443b-90a7-47421386992c', 'anamnesi',       'Anamnesi delle cure primarie',     5, 'anamnesi in farmacia, triage, red flags, cure primarie, counselling farmaceutico, aderenza terapeutica',                                                     '2026-04-10'),

  -- Area 6 – Preparazione medicinali
  ('a9d2f4fb-e95d-4016-83e5-ca2f3af55619', 'galenica',       'Preparazione medicinali e galenica', 6, 'preparazione galenica, GMP svizzere, categorie dispensazione, Lista A/B/C, calcoli farmaceutici, preparazioni sterili',                                  '2026-04-10'),

  -- Area 7 – Risultati di laboratorio
  ('cb6ad501-eb5c-4eac-9be5-2889c4316e71', 'analisi_laboratorio', 'Analisi di laboratorio',      7, 'esami ematici, eGFR, funzione epatica, emocromo, HbA1c, INR, CRP, elettroliti, interpretazione valori di riferimento',                                      '2026-04-11'),

  -- Area 9 – Vaccinazioni e prelievi
  ('3111ff5d-0c02-47ca-b7c4-75d993ae7f34', 'vaccini',        'Vaccini e BLS',                    9, 'vaccinazioni in farmacia, piano vaccinale svizzero, BLS, anafilassi, vaccini anti-influenzali, COVID, HPV',                                                  '2026-04-10'),

  -- Area 10 – Altro (notebook di riferimento, non direttamente legati a domande d''esame)
  ('8572f9a6-06d0-42fc-a174-dd081e513bab', 'tariffa_2025',   'Tariffa 2025',                    10, null, '2026-04-09'),
  ('b100d798-6648-42f8-bd8c-96464de02219', 'nuovi_farmaci',  'Neue Medikamente 2024–2025',      10, null, '2026-04-09'),
  ('4c18c66f-7203-4db8-9b9d-745155c7eb70', 'linee_guida',    'Linee Guida',                     10, null, '2026-03-20'),
  ('4ca412a1-4eae-428e-8b9e-519496876ba0', 'regolamento_fph','FPH Regolamento',                 10, null, '2026-03-07');

-- ===== Aggiunge notebook_id a questions =====
alter table public.questions
  add column notebook_id uuid references public.notebooks(id);

create index idx_questions_notebook on public.questions(notebook_id);
create index idx_notebooks_area on public.notebooks(area_id);
