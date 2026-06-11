# Implementation Plan: Role-Based Exam Preparation

## Overview

Aggiungere preparazione esame strutturata per i 9 ruoli FPH. Ogni ruolo avrà: studio guidato (learning objectives), question bank dedicata, mini-quiz, e tracciamento progresso.

**Branch**: `feat/role-based-study`
**Target**: fph-prep (React 19 + Vite + FastAPI + Supabase + Vercel)

---

## Fase 1: Data Layer (giorno 1)

### 1.1 Schema Supabase

**Migration 009: `role_metadata`**

```sql
-- Estende tabella areas con metadati ruolo
ALTER TABLE areas ADD COLUMN IF NOT EXISTS role_number INTEGER;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS weight_percent INTEGER;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS question_count INTEGER;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS study_days INTEGER;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS learning_objectives JSONB DEFAULT '[]';
ALTER TABLE areas ADD COLUMN IF NOT EXISTS description TEXT;

-- Tabella topics per sotto-argomenti
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  learning_objectives JSONB DEFAULT '[]',
  source_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indice per query per area
CREATE INDEX idx_topics_area ON topics(area_id);
```

### 1.2 Seed Data

Popolare 9 aree con dati da wiki:

| role_number | name | weight | questions | days |
|-------------|------|--------|-----------|------|
| 1 | Validazione ricette e piani terapeutici | 7 | 7 | 2 |
| 2 | Fitoterapia | 3 | 3 | 1 |
| 3 | Medicina complementare | 3 | 3 | 1 |
| 4 | Farmacia clinica | 50 | 50 | 15 |
| 5 | Anamnesi e terapia | 10 | 10 | 3 |
| 6 | Preparazione di medicinali | 7 | 7 | 2 |
| 7 | Risultati di laboratorio | 7 | 7 | 2 |
| 8 | Situazioni d'emergenza | 7 | 7 | 2 |
| 9 | Vaccinazioni e prelievi | 7 | 7 | 2 |

Topics popolati da `linea_guida.txt` (Farmacia Clinica, Anamnesi, Validazione) e `modalita.txt` (tutti i ruoli).

### 1.3 Collegamento domande esistenti

```sql
-- Le domande esistenti agganciate a area_id + topic_id
ALTER TABLE questions ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id);
```

**File**: `supabase/migrations/009_role_metadata.sql`

---

## Fase 2: Admin Backend (giorno 1-2)

### 2.1 API Aree

```python
# admin/app/routes/areas.py

GET    /api/areas              # Lista 9 aree con metadati
GET    /api/areas/{id}         # Area + topics + learning objectives
PUT    /api/areas/{id}         # Aggiorna metadati area
POST   /api/areas/{id}/topics  # Crea topic
PUT    /api/topics/{id}        # Aggiorna topic
DELETE /api/topics/{id}        # Elimina topic
```

### 2.2 API Generazione per Area

```python
# admin/app/routes/generate.py (estendere)

POST /api/generate/area/{id}   # Genera question bank per area specifica
POST /api/generate/all         # Genera per tutte le aree (batch)
GET  /api/generate/status/{id} # Stato job generazione
```

Configurazione generazione per area:

```yaml
# admin/notebooks.yaml (estendere)
areas:
  4:  # Farmacia Clinica
    topics: [diabete, cardiovascolare, interazioni, polifarmacoterapia, ...]
    question_count: 50
    formats: [MC-A, MC-Kprime]
    sources:
      - raw/linea_guida.txt
      - raw/Measured Examinator.md
```

### 2.3 Seed Script

```python
# admin/scripts/seed_areas.py
# Popola aree + topics da dati strutturati
# Eseguito una volta: python seed_areas.py
```

**File**: `admin/app/routes/areas.py`, `admin/scripts/seed_areas.py`

---

## Fase 3: Admin Frontend (giorno 2-3)

### 3.1 Pagina Gestione Aree

```
/admin/areas
├── Lista 9 aree (card grid)
│   ├── Nome, peso%, domande, giorni
│   └── Progress bar generazione contenuti
└── Click → /admin/areas/:id
    ├── Form metadati (peso, giorni, descrizione)
    ├── Lista topics (CRUD inline)
    ├── Learning objectives (editor JSON o lista)
    └── Bottone "Genera domande"
```

### 3.2 Estensione Generate

```
/admin/generate
├── Select area (o "tutte")
├── Select formato (MC-A, MC-Kprime, misto)
├── Preview topic coperti
└── Bottone "Avvia generazione"
```

### 3.3 Estensione Catalog

```
/admin/catalog
├── Filtro per area
├── Badge conteggio domande per area
└── Bulk actions (sposta tra aree)
```

**File**: 
- `src/pages/admin/Areas.jsx`
- `src/pages/admin/AreaDetail.jsx`
- Modifiche: `src/pages/admin/Generate.jsx`, `src/pages/admin/Catalog.jsx`

---

## Fase 4: App Frontend (giorno 3-5)

### 4.1 Study Hub ridisegnato

```
/study
├── Header: "Preparazione per Ruolo"
├── Overview card: progresso totale, domande completate
└── Grid 9 ruoli (card):
    ├── Ruolo 4 evidenziato (50% badge)
    ├── Nome, peso%, domande disponibili
    ├── Progress bar (domande fatte / totali)
    ├── Score %
    └── Click → /study/area/:area_id
```

### 4.2 Area Detail Page

```
/study/area/:area_id
├── Header: nome ruolo, peso esame, giorni studio
├── Tab 1: Panoramica
│   ├── Descrizione ruolo
│   ├── Learning objectives (checklist da linea guida)
│   └── Topics coperti
├── Tab 2: Question Bank
│   ├── Lista domande per topic
│   ├── Filtro per difficoltà, stato (nuova/fatta/sbagliata)
│   └── Click domanda → modale dettaglio
├── Tab 3: Mini-Quiz
│   ├── Config: n° domande (5/10/tutte), formato (MC-A/Kprime/misto)
│   ├── Bottone "Inizia quiz"
│   └── Dopo: risultati, tempo, error review
└── Tab 4: Progresso
    ├── Score per topic
    ├── Tempo medio risposta
    └── Suggerimenti (topic deboli da ripassare)
```

### 4.3 Componenti Nuovi

```
src/components/study/
├── RoleCard.jsx           # Card ruolo per grid
├── RoleGrid.jsx           # Grid 9 ruoli
├── LearningObjectives.jsx # Checklist interattiva
├── TopicList.jsx          # Lista topic per area
├── QuestionPreview.jsx    # Anteprima domanda in lista
├── MiniQuizConfig.jsx     # Configurazione mini-quiz
└── RoleProgress.jsx       # Progresso per ruolo
```

### 4.4 Estensione Stats

Aggiungere sezione "Per Ruolo" in `/stats`:

```
/stats
├── Overview (esistente)
├── Per Ruolo (nuovo)
│   ├── Bar chart: score % per ruolo
│   ├── Radar chart: copertura 9 ruoli
│   └── Highlight ruolo 4
└── Cronologia quiz (esistente)
```

### 4.5 API Frontend

```javascript
// src/lib/areasApi.js (nuovo)
export async function fetchAreas()           // GET aree con progresso
export async function fetchArea(id)          // GET area + topics + progresso
export async function fetchAreaQuestions(id) // GET domande per area
export async function startAreaQuiz(id, config) // POST inizia quiz area
export async function submitAreaQuiz(id, answers) // POST invia risposte
```

**File**:
- `src/pages/Study.jsx` (modifica)
- `src/pages/StudyArea.jsx` (nuovo)
- `src/pages/Stats.jsx` (modifica)
- `src/lib/areasApi.js` (nuovo)
- `src/components/study/*` (nuovi)

---

## Fase 5: Integrazione Pipeline (giorno 5)

### 5.1 Config generazione per ruolo

```yaml
# admin/config_role_4.yaml (esempio)
role: 4
name: "Farmacia Clinica"
topics:
  - diabete
  - malattie_cardiovascolari
  - interazioni_rilevanti
  - polifarmacoterapia
  - follow_up_post_dimissione
  - farmacovigilanza
  # ... 20+ topics da linea_guida.txt
question_count: 50
formats: [MC-A, MC-Kprime]
sources:
  - raw/linea_guida.txt
  - raw/Measured Examinator.md
output: supabase
```

### 5.2 Script generazione

```bash
# Genera per ruolo specifico
python run_pipeline.py --config config_role_4.json

# Genera tutte le aree
python run_pipeline.py --config config_all_roles.json
```

---

## Fase 6: Test e Raffinamento (giorno 5-6)

- [ ] Seed aree + topics verificato in Supabase
- [ ] API aree risponde correttamente
- [ ] Admin CRUD aree funzionante
- [ ] Generazione domande per area produce output corretto
- [ ] Study hub mostra 9 ruoli con pesi
- [ ] Area detail carica topics e learning objectives
- [ ] Mini-quiz per ruolo: creazione, svolgimento, risultati
- [ ] Stats per ruolo aggiornati dopo quiz
- [ ] Mobile responsive (candidati useranno anche da telefono)

---

## Riepilogo File

| File | Azione | Fase |
|------|--------|------|
| `supabase/migrations/009_role_metadata.sql` | Nuovo | 1 |
| `admin/app/routes/areas.py` | Nuovo | 2 |
| `admin/app/routes/generate.py` | Modifica | 2 |
| `admin/scripts/seed_areas.py` | Nuovo | 2 |
| `admin/notebooks.yaml` | Modifica | 5 |
| `admin/config_role_*.json` | Nuovi (9) | 5 |
| `src/pages/admin/Areas.jsx` | Nuovo | 3 |
| `src/pages/admin/AreaDetail.jsx` | Nuovo | 3 |
| `src/pages/admin/Generate.jsx` | Modifica | 3 |
| `src/pages/admin/Catalog.jsx` | Modifica | 3 |
| `src/pages/Study.jsx` | Modifica | 4 |
| `src/pages/StudyArea.jsx` | Nuovo | 4 |
| `src/pages/Stats.jsx` | Modifica | 4 |
| `src/lib/areasApi.js` | Nuovo | 4 |
| `src/components/study/*` | Nuovi (7) | 4 |

---

## Note

- **Priorità Ruolo 4**: iniziare sviluppo e test da Ruolo 4 (Farmacia Clinica). È il 50% dell'esame e il più complesso. Gli altri ruoli seguono lo stesso pattern.
- **Riutilizzo**: il componente `MiniQuizConfig` e il flusso quiz sono uguali per tutti i ruoli — costruirli una volta, parametrizzare per ruolo.
- **Learning objectives**: i dati da `linea_guida.txt` sono già strutturati come checklist. Convertire in JSON per Supabase.
- **Topic IDs**: `modalita.txt` contiene già riferimenti a topic con UUID. Verificare se questi esistono in Supabase.
