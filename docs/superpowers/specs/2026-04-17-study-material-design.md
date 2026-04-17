# Study Material — Design Spec

**Date:** 2026-04-17
**Status:** Draft (awaiting user review)
**Scope:** Sub-progetto 4 — Materiale di studio (riassunti + spiegazioni arricchite)

---

## 1. Goal

Aggiungere materiale di studio testuale (con immagini) all'app FPH Prep, strutturato per sotto-argomento (topic = notebook). Utenti possono:

1. Studiare **prima del quiz** via nuovo menu "Studia".
2. **Ripassare un topic dopo un errore** via link contestuale in pagina Results.
3. Leggere **spiegazioni arricchite** (markdown) sotto ogni domanda sbagliata.

Contenuti generati fuori app con [notebooklm-py](https://github.com/teng-lin/notebooklm-py), importati nel DB via script + UI admin.

---

## 2. Non-Goals (YAGNI)

- Multilingua DE/FR/EN (schema predisposto, contenuto solo IT in MVP).
- Flashcard / ripetizione spaziata.
- Audio / podcast (NotebookLM audio overview).
- Generazione runtime / API diretta NotebookLM.
- Ricerca full-text dei contenuti.
- Versioning contenuti (ultima versione sovrascrive).
- Traduzione automatica.

---

## 3. Architecture

### 3.1 Data model

**Tabella `notebooks` (esistente):** nessuna modifica. Resta metadata (key, title, area, argomento).

**Nuova tabella `notebook_contents`:**

```sql
create table public.notebook_contents (
  id uuid default gen_random_uuid() primary key,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  lang text not null default 'it' check (lang in ('it','de','fr','en')),
  content_md text not null,
  is_free boolean default false,
  source_hash text,                       -- sha256 del md sorgente (idempotenza)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (notebook_id, lang)
);

create index idx_notebook_contents_notebook on public.notebook_contents(notebook_id);
```

**RLS:**

```sql
alter table public.notebook_contents enable row level security;

-- SELECT: free per tutti, non-free solo premium, admin legge tutto
create policy "read_free_or_premium"
  on public.notebook_contents for select
  using (
    is_free = true
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_premium = true or profiles.is_admin = true)
    )
  );

-- Admin-only write
create policy "admin_write"
  on public.notebook_contents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

**`questions.explanation` (esistente):** nessuna modifica schema. Campo `text`. Admin scrive markdown. Rendering client con `react-markdown`.

### 3.2 Storage

Supabase Storage bucket **`summaries`** (pubblico in read).

Convenzione path: `summaries/<notebook_key>/<filename>`.

Policy storage:
- Public read (bucket pubblico).
- Write/delete solo admin (policy su `storage.objects`).

### 3.3 File system sorgente

Cartella `local/summaries/` (gitignored), generata da notebooklm-py:

```
local/summaries/
├── interazioni/
│   ├── content.md             # output notebooklm-py
│   ├── images/
│   │   ├── figura-1.png
│   │   └── tabella-2.png
│   └── meta.json              # { "is_free": true, "lang": "it" }
├── deprescrizione/
│   └── ...
```

`content.md` referenzia immagini come `![alt](./images/figura-1.png)` (path relativo).

`meta.json` opzionale; default `{ is_free: false, lang: "it" }`.

---

## 4. Import Pipeline

**Script `scripts/import-summaries.js`** (Node, riusa stile `scripts/import-questions.js`).

Algoritmo:

1. Carica `.env.local` (Supabase URL + `SUPABASE_SERVICE_ROLE_KEY` per bypass RLS).
2. Legge `local/summaries/*/` → per ogni cartella:
   - Estrae `key` da nome cartella.
   - Query `notebooks` per `key` → ottiene `notebook_id`. Se manca: log errore, skip.
   - Legge `meta.json` (opzionale).
   - Upload immagini `images/*` a `summaries/<key>/` (upsert: skip se hash uguale).
   - Rewrite markdown: `./images/X.png` → URL pubblico Supabase.
   - Calcola `sha256(content_md)`.
   - Upsert `notebook_contents` su `(notebook_id, lang)`:
     - Se `source_hash` invariato → skip.
     - Altrimenti insert/update + bump `updated_at`.
3. Log finale: `N creati / N aggiornati / N skippati / N errori`.

**Comando:** `npm run import-summaries` (aggiungi a `package.json`).

Idempotente: 2 esecuzioni consecutive → 2ª = 0 changes.

---

## 5. Frontend — User side

### 5.1 Nuovo menu "Studia"

`src/components/UserLayout.jsx`: aggiungi voce nav tra "Home" e "Stats".
Chiave i18n: `nav.study` in tutti e 4 locales.

### 5.2 Routes

| Path | Component | Descrizione |
|------|-----------|-------------|
| `/study` | `Study.jsx` | Lista aree (riuso `AREAS` + counts notebook per area) |
| `/study/area/:area_id` | `StudyArea.jsx` | Lista notebook per area, badge Free/Premium, lock icon |
| `/study/topic/:notebook_key` | `StudyTopic.jsx` | Render markdown del contenuto |

### 5.3 Premium gate client

`StudyTopic.jsx`:
- Query `notebook_contents` via `notebook_id` e `lang='it'`.
- Se RLS nega (non premium + non free) → redirect `/upgrade`.
- Lista topic (`StudyArea`): flag `is_free` sempre visibile nel JOIN. Topic locked mostrano lucchetto + CTA.

### 5.4 Component `<MarkdownView />`

`src/components/MarkdownView.jsx`:
- Dipendenze: `react-markdown` + `remark-gfm`.
- Props: `content` (string).
- Wrapping: `<div className="prose prose-invert max-w-none">`.
- Immagini: `loading="lazy"`, rounded, max-width 100%.
- Sanitize: default (no HTML raw).

Usato in: `StudyTopic.jsx`, `ContentEditor.jsx` (preview), `Results.jsx` (render `explanation`).

### 5.5 Modifica `Results.jsx`

Stato attuale: la pagina mostra score, ring %, breakdown per area. **Non** mostra una sezione "Revisione risposte" con la lista domande + spiegazione.

Aggiunta:

1. Nuova sezione "Revisione risposte" dopo il breakdown area: lista delle domande della sessione con indicatore corretto/sbagliato (focus sulle sbagliate).
2. Per ogni domanda sbagliata:
   - Testo domanda, risposta utente, risposta corretta.
   - Render `question.explanation` via `<MarkdownView />` (il campo è `text`; può contenere markdown).
   - Se `question.notebook_id` non null **e** esiste `notebook_contents` per quel notebook (lang='it'): button "📖 Ripassa: {notebook.title}" → `/study/topic/:notebook_key`.
3. Gate premium sul link: se topic target è `is_free=false` e utente non premium → CTA upgrade invece del link diretto.

`fetchSession` dovrà includere `explanation`, `notebook_id` e (join leggero) `notebooks.key`, `notebooks.title` per le domande della sessione.

---

## 6. Frontend — Admin side

### 6.1 Routes

| Path | Component | Descrizione |
|------|-----------|-------------|
| `/admin/contents` | `admin/Contents.jsx` | Lista notebook + stato contenuto |
| `/admin/contents/:notebook_id` | `admin/ContentEditor.jsx` | Editor markdown |

### 6.2 `admin/Contents.jsx`

Colonne tabella:
- `key`, `title`, `area`, `lang` ('it'), status (✓ / ✗), `is_free`, `updated_at`.
- Filtro per area.
- Row click → editor.

### 6.3 `admin/ContentEditor.jsx`

Layout split-pane:
- **Sinistra:** textarea markdown monospace (80 colonne).
- **Destra:** `<MarkdownView>` preview live.

Funzionalità:
- Toggle `is_free`.
- Bottone "Upload immagine" → apre file picker → upload a `summaries/<key>/<filename>` via Supabase Storage → inserisce `![alt](URL)` al cursore.
- Bottone Salva → upsert `notebook_contents` (lang='it').

Script import resta primary path; admin UI = fine-tuning.

### 6.4 Modifica `AdminLayout.jsx`

Aggiungi tab "Contenuti" sidebar.

---

## 7. API helpers

`src/lib/notebookContentsApi.js`:

```js
// public reads (applicata RLS)
export async function fetchContentByKey(key, lang = 'it') { ... }
export async function fetchNotebooksByArea(areaId) { ... }  // join notebook_contents

// admin writes
export async function upsertContent({ notebook_id, lang, content_md, is_free }) { ... }
export async function uploadImage(notebookKey, file) { ... }
```

Riuso stile `src/lib/adminApi.js`.

---

## 8. i18n

Nuove chiavi in `src/locales/{it,de,fr,en}.json`:

- `nav.study` — "Studia" / "Lernen" / "Étudier" / "Study"
- `study.allAreas` — header pagina Study
- `study.topicLocked` — "Contenuto premium"
- `study.upgradeCta` — "Passa a Premium per sbloccare"
- `results.reviewTopic` — "Ripassa questo argomento"
- `admin.nav.contents` — "Contenuti"

(Stringhe UI in tutte 4 lingue; contenuti markdown solo IT MVP.)

---

## 9. Migrations & dependencies

**Nuove migration:**
- `supabase/migrations/007_notebook_contents.sql` — tabella + RLS.
- `supabase/migrations/008_summaries_storage.sql` — bucket + policies (o setup manuale Supabase Dashboard, documentato in README).

**npm deps:**
- `react-markdown` (runtime)
- `remark-gfm` (runtime)
- `@tailwindcss/typography` (dev, plugin Tailwind per `.prose`)

**Tailwind config:** aggiungi plugin `@tailwindcss/typography`.

---

## 10. Premium gating — regole complete

| Caso | Utente free | Utente premium | Admin |
|------|-------------|----------------|-------|
| Lista aree `/study` | ✓ | ✓ | ✓ |
| Lista topic area `/study/area/:id` | ✓ (badge/lock) | ✓ | ✓ |
| Topic free `/study/topic/:key` (is_free=true) | ✓ | ✓ | ✓ |
| Topic premium (is_free=false) | ✗ redirect `/upgrade` | ✓ | ✓ |
| Link "Ripassa" in Results | ✓ se topic free, else upgrade CTA | ✓ | ✓ |
| Admin routes | ✗ | ✗ | ✓ |

Enforcement:
- Client: route guard + UI feedback.
- Server: RLS policy su `notebook_contents` (source of truth).

Default seeding: primi 2 notebook per area flagged `is_free=true` nel loro `meta.json`. Resto false. Admin può modificare post-import.

---

## 11. Files changed — summary

**Creati:**
- `supabase/migrations/007_notebook_contents.sql`
- `supabase/migrations/008_summaries_storage.sql` (o doc setup manuale)
- `scripts/import-summaries.js`
- `src/pages/Study.jsx`
- `src/pages/StudyArea.jsx`
- `src/pages/StudyTopic.jsx`
- `src/pages/admin/Contents.jsx`
- `src/pages/admin/ContentEditor.jsx`
- `src/components/MarkdownView.jsx`
- `src/lib/notebookContentsApi.js`

**Modificati:**
- `src/App.jsx` — route nuove (user + admin).
- `src/components/UserLayout.jsx` — voce menu "Studia".
- `src/components/admin/AdminLayout.jsx` — tab "Contenuti".
- `src/pages/Results.jsx` — `<MarkdownView>` per `explanation` + CTA "Ripassa topic".
- `src/locales/it.json`, `de.json`, `fr.json`, `en.json` — nuove chiavi.
- `package.json` — dipendenze + script `import-summaries`.
- `tailwind.config.js` — plugin typography.
- `.gitignore` — verifica che `local/` sia ignorato (già).

---

## 12. Verification checklist

Manuale (post-implementazione):

1. Migration 007 applicata senza errori. `\d notebook_contents` mostra schema + RLS.
2. Bucket `summaries` accessibile in read anonimo via URL.
3. `npm run import-summaries` con 1 cartella test → 1 riga in `notebook_contents`, 1+ file in Storage.
4. Re-run stesso import → 0 changes.
5. Utente free:
   - `/study` lista aree.
   - `/study/area/1` lista topic, 2 con badge Free, altri con lock.
   - Click topic free → render markdown + immagini.
   - Click topic premium → redirect `/upgrade`.
6. Utente premium: tutti i topic accessibili.
7. Admin:
   - `/admin/contents` lista notebook, filtri area OK.
   - Editor: scrivi markdown, upload immagine → URL inserito al cursore, preview live, save → aggiornato in DB.
8. Quiz → Results pagina:
   - Risposta sbagliata: `explanation` markdown renderizzato (tabelle, bold, liste).
   - Button "Ripassa topic" appare se `notebook_id` + contenuto esistono.
   - Click naviga a pagina topic (con gate premium).
9. i18n: cambia lingua app → voce menu "Studia" traduce. Contenuto topic resta IT (atteso).

---

## 13. Open questions / follow-up

(Da risolvere in plan o iterazione successiva — non bloccanti per spec.)

- Quali notebook specifici marchiare `is_free=true` al seeding (decisione editoriale, non tecnica).
- Gestione caching contenuti lato client (utile se contenuti grandi; per ora: query diretta per page load).
- Aggiunta `search` basic su topic by title quando i contenuti cresceranno (fuori scope MVP).
- Multilingua roll-out: rigenerare content_md per `lang='de'|'fr'|'en'` e inserire righe; schema pronto.
