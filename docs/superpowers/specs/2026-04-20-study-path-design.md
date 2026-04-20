# Study Path per Notebook — Design

**Data:** 2026-04-20  
**Approccio scelto:** A — Estendi artifacts esistenti

## Obiettivo

Per ogni notebook farmaceutico, generare un "percorso di studi" libero (non sequenziale) composto da artifact tematici. L'utente sceglie cosa fare: legge la guida, usa le flashcard, esplora la mappa mentale, fa il quiz.

## Data Model

### Migrazioni SQL

**003_extend_artifact_types.sql** — estende i constraint `type` su tabelle esistenti:

```sql
ALTER TABLE artifacts DROP CONSTRAINT artifacts_type_check;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_type_check
  CHECK (type IN ('summary','quiz','iconography','study_guide','flashcards','mind_map'));

ALTER TABLE generation_jobs DROP CONSTRAINT generation_jobs_type_check;
ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_type_check
  CHECK (type IN ('summary','quiz','iconography','study_guide','flashcards','mind_map'));
```

Nessuna nuova tabella. Il percorso = `SELECT * FROM artifacts WHERE notebook_id = X`.

### Formati artifact

| type | format | content shape |
|---|---|---|
| `study_guide` | `markdown` | `{"text": "..."}` |
| `flashcards` | `json` | `{"cards": [{"q": "...", "a": "..."}]}` |
| `mind_map` | `json` | `{"nodes": [...]}` (formato NotebookLM mind map) |

## Backend (admin — FastAPI)

### Nuovo service: `app/services/study_path_service.py`

Genera 3 artifact per un notebook via NotebookLM Python API:
1. `study_guide` → `client.artifacts.generate_report(type="study_guide")`
2. `flashcards` → `client.artifacts.generate_flashcards()`
3. `mind_map` → `client.artifacts.generate_mind_map()`

Per ogni tipo:
- Crea `generation_job` status=`pending`
- Lancia generazione async
- Attende completamento (`wait_for_completion`)
- Scarica contenuto
- Salva in `artifacts`
- Aggiorna job status=`done`

Il `notebooklm_notebook_id` viene da `notebooks.yaml` (già mappato per tutti i 50+ notebook).

### Nuovi endpoint

```
POST /api/notebooks/{notebook_id}/study-path/generate
  → crea 3 generation_jobs + lancia background task

GET /api/notebooks/{notebook_id}/study-path
  → restituisce tutti gli artifacts del notebook raggruppati per type
```

## Frontend utente (React — /src)

### Modifica `StudyTopic.jsx`

Aggiunge sezione "Percorso di studi" dopo il contenuto principale esistente.

**Nuova funzione** `fetchStudyPath(notebookKey)` in `lib/notebookContentsApi.js`:
- Chiama `GET /api/notebooks/{id}/study-path`
- Restituisce array di artifact disponibili

**Card per tipo:**

| Artifact | Icona | Comportamento |
|---|---|---|
| `study_guide` | 📖 | Expand inline con `MarkdownView` (già usato) |
| `flashcards` | 🃏 | Flip card interattivo (domanda → tap → risposta) |
| `mind_map` | 🗺️ | Lista gerarchica indentata (no lib esterna) |
| `quiz` | ❓ | Link a `/quiz?notebook=X` (già esiste) |

Se artifact non ancora generato → card grayed out con label "In arrivo".

## Cosa NON è incluso

- Audio overview / video (escluso per complessità)
- Percorso sequenziale obbligatorio (navigazione libera)
- Nuove tabelle Supabase
