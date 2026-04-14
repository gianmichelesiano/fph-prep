# Seed Tests — Design Spec

## Overview

Script Node.js `scripts/seed-tests.js` che importa tutte le simulazioni e domande dai file JSON in `fph-exam/src/data/tests/` in Supabase, con deduplicazione delle domande tramite `content_hash`.

## Schema Change

Aggiungere colonna a `questions`:
```sql
alter table public.questions add column content_hash text unique;
create index idx_questions_content_hash on public.questions(content_hash);
```

Nuovo file migration: `supabase/migrations/004_content_hash.sql`

## Mapping JSON → Supabase

### simulations
| JSON | DB |
|---|---|
| `id` (es. `simulazione-20260307-1630`) | `legacy_id` |
| `title` | `title` |
| `area` | `area` (sempre 4 nei file esistenti) |
| `timer` | `timer` |
| `'it'` (hardcoded) | `lang` |
| `false` (hardcoded) | `is_free` |
| `'active'` (hardcoded) | `status` |

### questions
| JSON | DB |
|---|---|
| `q.domanda` | `text` |
| `q.tipo` mappato | `type` (`multipla_scelta`→`multiple_choice`, `kprim`→`kprim`) |
| `q.opzioni` | `options` (jsonb, formato originale preservato) |
| `q.risposta_corretta` | `correct_answer` |
| `q.motivazione` | `explanation` |
| `q.ruolo` | `area` (1-9) |
| `q.tema` | `topic` |
| `'it'` | `lang` |
| `'active'` | `status` |
| sha256 di `(domanda+tipo+risposta_corretta)` | `content_hash` |
| lookup da notebooks per area | `notebook_id` |

### simulation_questions
| Campo | Valore |
|---|---|
| `simulation_id` | UUID della simulazione appena upsertata |
| `question_id` | UUID della domanda (esistente o nuova) |
| `position` | `q.numero` |

## Deduplicazione

`content_hash = sha256(q.domanda + '|' + q.tipo + '|' + q.risposta_corretta)`

Upsert su `content_hash`:
- Se non esiste → inserisce nuova domanda
- Se esiste → aggiorna `topic` e `explanation` solo se il record esistente li ha null (non sovrascrive dati già buoni)

## Notebook Lookup

All'avvio lo script carica tutti i notebook da Supabase e costruisce una map `area_id → notebook_id` prendendo il primo notebook attivo per quell'area (ordinato per `key`). Il mapping atteso per le aree presenti nei JSON:

| Area | Notebook key atteso |
|---|---|
| 1 | `interazioni` |
| 2 | `fitoterapia` |
| 3 | `omeopatia` |
| 4 | `respiratorie` |
| 5 | `anamnesi` |
| 6 | `galenica` |
| 7 | `analisi_laboratorio` |
| 8 | `vaccini` |
| 9 | `vaccini` |

Il `notebook_id` viene assegnato solo alle domande nuove. Le domande già esistenti non vengono toccate.

## Idempotenza

- `simulations`: upsert on conflict `legacy_id` → update `title`, `timer`
- `questions`: upsert on conflict `content_hash` → update `topic`, `explanation` (solo se null)
- `simulation_questions`: insert on conflict `(simulation_id, question_id)` → do nothing

Rieseguibile senza duplicati.

## Output

```
Loading notebooks from Supabase...  10 notebooks loaded
Processing simulazione-20260307-1630...
  ✓ simulation upserted
  ✓ 101 questions: 87 new, 14 existing
  ✓ 101 simulation_questions linked
...
Done. Total: 13 simulations, 542 unique questions inserted, 238 reused.
```

## Dipendenze

- `@supabase/supabase-js` (già nel progetto)
- `dotenv` (già nel progetto, per leggere `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`)
- Node.js built-in `crypto` (per sha256)
- Node.js built-in `fs/path` (per leggere i JSON)

## Esecuzione

```bash
node scripts/seed-tests.js
```

Deve girare da `fph-prep/` root. Legge `.env` per le variabili Supabase.
