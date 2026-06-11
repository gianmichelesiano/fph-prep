# Specs: Role-Based Exam Preparation

## Requisiti Funzionali

### RF1: Study Hub per Ruoli
L'utente vede tutti i 9 ruoli dell'esame FPH con:
- Nome ruolo, peso percentuale sull'esame, numero domande, giorni studio
- Barra progresso personale (domande completate / totali)
- Punteggio medio per ruolo
- Evidenziazione visiva del Ruolo 4 (50% esame)

### RF2: Area Detail
Pagina dedicata per ruolo con 4 tab:
1. **Panoramica**: descrizione, learning objectives come checklist, topics coperti
2. **Question Bank**: domande filtrate per topic, con stato (nuova/completata/errori)
3. **Mini-Quiz**: generazione quiz parametrizzato (n° domande, formato, difficoltà)
4. **Progresso**: metriche per topic, tempo medio, suggerimenti automatici

### RF3: Mini-Quiz per Ruolo
- Configurabile: numero domande (5/10/20/tutte), formato (MC-A/Kprime/misto)
- Timer opzionale
- Scoring immediato con motivazione per ogni risposta
- Salvataggio risultato su Supabase
- Review errori con riferimento al topic

### RF4: Progresso per Ruolo
- Score % per ruolo e per topic
- Grafico radar 9 ruoli
- Tempo medio risposta
- Suggerimenti: "Il tuo punteggio in Farmacia Clinica è 52%. Dedica più tempo a diabete e interazioni."

### RF5: Admin Gestione Aree
- CRUD aree (metadati: nome, peso, giorni, descrizione)
- CRUD topics per area (nome, descrizione, learning objectives)
- Collegamento domande ad area/topic
- Avvio generazione contenuti per area specifica

---

## Modello Dati

### Tabella `areas` (estesa)

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | PK |
| name | TEXT | Nome ruolo (es. "Farmacia clinica") |
| role_number | INTEGER | 1-9 |
| weight_percent | INTEGER | Peso sull'esame (3, 7, 10, 50) |
| question_count | INTEGER | Domande nell'esame (3, 7, 10, 50) |
| study_days | INTEGER | Giorni studio WBP |
| description | TEXT | Descrizione ruolo |
| learning_objectives | JSONB | Array di {objective, category} |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabella `topics`

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | PK |
| area_id | UUID | FK → areas.id |
| name | TEXT | Nome topic |
| description | TEXT | |
| learning_objectives | JSONB | Array di stringhe |
| source_ids | TEXT[] | Riferimenti a fonti |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabella `questions` (estesa)

Colonne aggiuntive:
- `area_id UUID REFERENCES areas(id)`
- `topic_id UUID REFERENCES topics(id)`

### Tabella `user_area_progress` (nuova)

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| user_id | UUID | FK → auth.users |
| area_id | UUID | FK → areas.id |
| questions_completed | INTEGER | Domande fatte |
| questions_correct | INTEGER | Risposte corrette |
| avg_time_seconds | FLOAT | Tempo medio risposta |
| last_quiz_at | TIMESTAMPTZ | Ultimo quiz |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| UNIQUE(user_id, area_id) | | |

---

## API Endpoints

### Admin Backend (FastAPI)

#### Aree
```
GET    /api/areas              → Area[]
GET    /api/areas/{id}         → Area + topics[]
PUT    /api/areas/{id}         → Area
POST   /api/areas              → Area
DELETE /api/areas/{id}         → 204
```

#### Topics
```
POST   /api/areas/{id}/topics  → Topic
PUT    /api/topics/{id}        → Topic
DELETE /api/topics/{id}        → 204
```

#### Generazione
```
POST   /api/generate/area/{id} → GenerationJob
GET    /api/generate/status/{job_id} → JobStatus
POST   /api/generate/all       → GenerationJob[]
```

#### Seed
```
POST   /api/seed/areas         → Seed result
```

### App Frontend (API client)

```javascript
// areasApi.js
fetchAreas()              → { areas: Area[], progress: UserAreaProgress[] }
fetchArea(id)             → { area: Area, topics: Topic[], progress: UserAreaProgress }
fetchAreaQuestions(id, filters?) → Question[]
startAreaQuiz(id, config) → { quiz_id, questions: Question[] }
submitAreaQuiz(id, answers) → { score, results: AnswerResult[] }
```

---

## Tipi TypeScript

```typescript
interface Area {
  id: string;
  name: string;
  role_number: number;
  weight_percent: number;
  question_count: number;
  study_days: number;
  description: string;
  learning_objectives: LearningObjective[];
  topics?: Topic[];
}

interface LearningObjective {
  objective: string;
  category?: string;
}

interface Topic {
  id: string;
  area_id: string;
  name: string;
  description: string;
  learning_objectives: string[];
  source_ids: string[];
}

interface UserAreaProgress {
  user_id: string;
  area_id: string;
  questions_completed: number;
  questions_correct: number;
  score_percent: number;
  avg_time_seconds: number;
  last_quiz_at: string;
}

interface MiniQuizConfig {
  question_count: number;    // 5 | 10 | 20 | -1 (tutte)
  format: 'MC-A' | 'MC-Kprime' | 'mixed';
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  only_errors?: boolean;     // solo domande sbagliate in precedenza
  timed?: boolean;
  time_minutes?: number;
}

interface AnswerResult {
  question_id: string;
  user_answer: string | boolean[];
  correct_answer: string | boolean[];
  is_correct: boolean;
  explanation: string;
  topic_id: string;
  topic_name: string;
}
```

---

## Componenti React

### `RoleCard`
```tsx
interface RoleCardProps {
  area: Area;
  progress?: UserAreaProgress;
  highlighted?: boolean;  // true per Ruolo 4
  onClick: () => void;
}
```

### `RoleGrid`
```tsx
interface RoleGridProps {
  areas: AreaWithProgress[];
  onRoleClick: (areaId: string) => void;
}
```

### `LearningObjectives`
```tsx
interface LearningObjectivesProps {
  objectives: LearningObjective[];
  completedIds?: string[];  // objectives checked off
  onToggle?: (id: string) => void;
}
```

### `MiniQuizConfig`
```tsx
interface MiniQuizConfigProps {
  area: Area;
  questionCount: number;
  onSubmit: (config: MiniQuizConfig) => void;
}
```

### `RoleProgress`
```tsx
interface RoleProgressProps {
  area: Area;
  progress: UserAreaProgress;
  topicProgress: TopicProgress[];
}
```

### `RoleRadarChart`
```tsx
interface RoleRadarChartProps {
  areas: AreaWithProgress[];  // Per stats page
}
```

---

## Flusso Utente

### Studio per Ruolo
```
/study
  → vedo 9 ruoli (Ruolo 4 grande e evidenziato)
  → clicco "Farmacia Clinica"
    → /study/area/4
      → Tab Panoramica: leggo obiettivi, vedo checklist
      → Tab Question Bank: esploro domande per diabete, interazioni...
      → Tab Mini-Quiz: scelgo 10 domande, formato misto, clicco Inizia
        → quiz parte, rispondo
        → risultati: 7/10, errori in "interazioni rilevanti"
        → "Riprova solo errori" o "Torna all'area"
      → Tab Progresso: score 70%, topic debole: interazioni
  → torno a /study, vedo progresso aggiornato
```

### Stats con Ruoli
```
/stats
  → Overview (esistente)
  → Sezione "Per Ruolo" (nuova)
    → Radar chart: 9 assi, il mio poligono
    → Bar chart: score % per ruolo
    → Ruolo 4 al centro con indicatore "50% esame"
    → Click su bar → va a /study/area/:id
```

---

## Vincoli

- **Admin-App Separation**: la generazione contenuti avviene solo in admin. L'app consuma dati da Supabase.
- **Priorità Ruolo 4**: UI deve evidenziare Ruolo 4. Algoritmo suggerimenti deve pesarlo 5x.
- **Offline**: i quiz non richiedono connessione continua (dati pre-caricati).
- **Responsive**: candidati usano la piattaforma anche da telefono durante lo studio.
- **Accessibilità**: domande Kprime devono essere navigabili da screen reader (4 toggle etichettati).
