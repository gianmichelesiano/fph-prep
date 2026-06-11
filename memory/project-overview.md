---
name: fph-prep project overview
description: Piattaforma preparazione esami FPH — admin crea contenuti, app li consuma
type: project
---

FPH-Prep è una piattaforma di preparazione esami per consulenti finanziari/assicurativi svizzeri.
Due facce: **admin** (crea contenuti) e **app** (li consuma).

**Why:** Separazione netta — tutto il contenuto (domande, simulazioni, study path, flashcard, riassunti) nasce nell'admin via pipeline LLM/NotebookLM e viene salvato su Supabase. L'app frontend consuma solo, non genera mai contenuto.

**How to apply:** Quando si modifica il frontend app, ricordare che i dati arrivano da Supabase e sono creati dall'admin. Non implementare mai generazione di contenuti nell'app. Per aggiungere contenuti, passare sempre dall'admin.

## Stack
- Frontend app: React 19 + Vite + Tailwind CSS + React Router 7
- Frontend admin: stesso stack React, rotte /admin/*
- Backend admin: Python FastAPI (admin/app/)
- Database: Supabase (PostgreSQL, Auth, REST API)
- Generazione: NotebookLM + DeepSeek via Anthropic protocol
- Deploy: Vercel (https://fph-prep.vercel.app)

## Flusso contenuti
1. Fonti configurate in admin/notebooks.yaml
2. Admin lancia pipeline (run_pipeline.py o API)
3. NotebookLM/LLM genera artifact (study path, flashcard, quiz, riassunti)
4. Salvataggio su Supabase (tabelle: notebook_contents, generation_jobs, summaries, questions, simulations)
5. App frontend consuma via notebookContentsApi e api.js

## Rotte App (utenti)
- / → Home
- /login, /register, /upgrade, /payment-success
- /quiz/:id, /results/:id, /stats, /settings
- /study, /study/area/:area_id, /study/topic/:key

## Rotte Admin
- /admin → Dashboard
- /admin/questions, /admin/questions/new, /admin/questions/:id
- /admin/simulations, /admin/simulations/:id
- /admin/users, /admin/catalog, /admin/generate
- /admin/contents, /admin/contents/:notebook_id

## DB Migrations (8)
001: schema iniziale (questions, users, progress)
002: areas
003: notebooks
004: content_hash (dedup)
005: simulations redesign
006: simulation_question_ids
007: notebook_contents
008: summaries_storage
