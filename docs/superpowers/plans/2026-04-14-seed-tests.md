# Seed Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importare tutte le simulazioni e domande dai JSON in `fph-exam/src/data/tests/` in Supabase con deduplicazione via `content_hash`, collegamento a notebooks, e flag `expert_approved`.

**Architecture:** Migration SQL per aggiungere `content_hash` e `expert_approved` a `questions`. Script Node.js ESM `scripts/seed-tests.js` che sostituisce il vecchio `import-questions.js`: upsert idempotente su `content_hash`, lookup notebook per area, output progressivo.

**Tech Stack:** Node.js ESM, `@supabase/supabase-js`, `dotenv`, `crypto` (built-in), `fs/path` (built-in)

---

### Task 1: Migration 004_content_hash.sql

**Files:**
- Create: `supabase/migrations/004_content_hash.sql`

- [ ] **Step 1: Creare il file migration**

```sql
-- ============================================================
-- FPH Prep – content_hash e expert_approved su questions
-- ============================================================

alter table public.questions add column if not exists content_hash text unique;
create index if not exists idx_questions_content_hash on public.questions(content_hash);

alter table public.questions add column if not exists expert_approved boolean default false;
```

- [ ] **Step 2: Eseguire nel Supabase Dashboard → SQL Editor**

Copia il contenuto del file e incollalo nel SQL Editor del dashboard Supabase. Esegui. Deve completare senza errori.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_content_hash.sql
git commit -m "feat: add content_hash and expert_approved columns to questions"
```

---

### Task 2: Script seed-tests.js

**Files:**
- Create: `scripts/seed-tests.js`

Il progetto è `"type": "module"` (ESM). Il file `.env` ha le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Creare `scripts/seed-tests.js`**

```js
#!/usr/bin/env node
/**
 * seed-tests.js
 * Importa simulazioni e domande da fph-exam/src/data/tests/ in Supabase.
 * Idempotente: rieseguibile senza creare duplicati.
 *
 * Usage: node scripts/seed-tests.js
 * Requires: VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const TESTS_DIR = join(__dirname, '../fph-exam/src/data/tests')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

// Mappa area_id → notebook_id (caricata da Supabase all'avvio)
let notebookByArea = {}

async function loadNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, area_id, key')
    .eq('active', true)
    .order('key', { ascending: true })
  if (error) throw error

  // Per ogni area prende il primo notebook (ordinato per key)
  for (const nb of data || []) {
    if (nb.area_id && !notebookByArea[nb.area_id]) {
      notebookByArea[nb.area_id] = nb.id
    }
  }
  console.log(`Notebooks caricati: ${Object.keys(notebookByArea).length} aree mappate`)
}

function contentHash(domanda, tipo, risposta) {
  return createHash('sha256')
    .update(`${domanda}|${tipo}|${risposta}`)
    .digest('hex')
}

function mapType(tipo) {
  if (tipo === 'multipla_scelta' || tipo === 'multiple_choice') return 'multiple_choice'
  if (tipo === 'kprim' || tipo === 'vero_falso') return 'kprim'
  return null
}

function buildQuestion(q, simArea) {
  const tipo = q.tipo || q.type
  const type = mapType(tipo)
  if (!type) return null

  const domanda = q.domanda || q.text || ''
  const risposta = q.risposta_corretta || q.correct_answer || ''
  const area = q.ruolo || simArea || 4

  const base = {
    text: domanda,
    type,
    correct_answer: String(risposta).toUpperCase(),
    explanation: q.motivazione || q.explanation || null,
    area,
    topic: q.tema || q.topic || null,
    lang: 'it',
    status: 'active',
    expert_approved: true,
    content_hash: contentHash(domanda, tipo, risposta),
    notebook_id: notebookByArea[area] || null,
  }

  if (type === 'multiple_choice') {
    // opzioni: {"A":"...","B":"...","C":"...","D":"..."} — preserva formato originale
    base.options = q.opzioni || q.options || {}
  } else {
    // kprim: opzioni: {"1":"...","2":"...","3":"...","4":"..."} — preserva formato originale
    base.options = q.opzioni || q.options || {}
  }

  return base
}

async function upsertSimulation(raw) {
  const { data, error } = await supabase
    .from('simulations')
    .upsert(
      {
        legacy_id: raw.id,
        title: raw.title || raw.titolo || raw.id,
        area: raw.area || 4,
        timer: raw.timer || 210,
        lang: 'it',
        is_free: false,
        status: 'active',
      },
      { onConflict: 'legacy_id' }
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function upsertQuestion(qData) {
  const { data, error } = await supabase
    .from('questions')
    .upsert(qData, {
      onConflict: 'content_hash',
      ignoreDuplicates: false,
    })
    .select('id, content_hash')
    .single()
  if (error) throw error
  return data
}

async function linkQuestion(simulationId, questionId, position) {
  const { error } = await supabase
    .from('simulation_questions')
    .upsert(
      { simulation_id: simulationId, question_id: questionId, position },
      { onConflict: 'simulation_id,question_id', ignoreDuplicates: true }
    )
  if (error) throw error
}

async function processFile(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  const questions = raw.questions || []

  if (!questions.length) {
    console.log(`  ⚠️  Nessuna domanda trovata, skip`)
    return { inserted: 0, reused: 0 }
  }

  // 1. Upsert simulazione
  const simId = await upsertSimulation(raw)
  console.log(`  ✓ Simulazione upserted (id: ${simId.slice(0, 8)}...)`)

  // 2. Upsert domande e collega
  let inserted = 0
  let reused = 0
  const seenHashes = new Set()

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const qData = buildQuestion(q, raw.area)

    if (!qData) {
      console.log(`  ⚠️  Domanda ${i + 1} tipo sconosciuto (${q.tipo}), skip`)
      continue
    }

    // Evita duplicati interni allo stesso file
    if (seenHashes.has(qData.content_hash)) {
      continue
    }
    seenHashes.add(qData.content_hash)

    // Controlla se già esiste prima dell'upsert per conteggio
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('content_hash', qData.content_hash)

    const row = await upsertQuestion(qData)
    count > 0 ? reused++ : inserted++

    await linkQuestion(simId, row.id, q.numero || i + 1)
  }

  return { inserted, reused }
}

async function main() {
  console.log('FPH Prep — Seed Tests\n')

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Mancano le variabili: VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  await loadNotebooks()
  console.log()

  const files = readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()

  console.log(`Trovati ${files.length} file JSON in ${TESTS_DIR}\n`)

  let totalInserted = 0
  let totalReused = 0

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]
    console.log(`[${i + 1}/${files.length}] ${fileName}`)
    try {
      const { inserted, reused } = await processFile(join(TESTS_DIR, fileName))
      totalInserted += inserted
      totalReused += reused
      console.log(`  ✓ ${inserted} nuove, ${reused} già esistenti\n`)
    } catch (err) {
      console.error(`  ❌ Errore: ${err.message}\n`)
    }
  }

  console.log('─'.repeat(50))
  console.log(`Done. ${files.length} simulazioni, ${totalInserted} domande inserite, ${totalReused} riutilizzate.`)
}

main().catch(err => {
  console.error('Errore fatale:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Verificare che il file sia sintatticamente corretto**

```bash
node --check scripts/seed-tests.js
```

Expected: nessun output (nessun errore di sintassi).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-tests.js
git commit -m "feat: add seed-tests.js with dedup, notebook lookup, expert_approved"
```

---

### Task 3: Esecuzione e verifica

**Files:** nessuno (solo esecuzione)

- [ ] **Step 1: Eseguire lo script**

```bash
node scripts/seed-tests.js
```

Expected output (esempio):
```
FPH Prep — Seed Tests

Notebooks caricati: 9 aree mappate

Trovati 13 file JSON in .../fph-exam/src/data/tests

[1/13] simulazione-20260307-1630.json
  ✓ Simulazione upserted (id: xxxxxxxx...)
  ✓ 87 nuove, 14 già esistenti

[2/13] simulazione-20260308-2048.json
...

──────────────────────────────────────────────────
Done. 13 simulazioni, 542 domande inserite, 238 riutilizzate.
```

- [ ] **Step 2: Verificare in Supabase Dashboard**

Aprire Table Editor → `questions`. Verificare:
- Righe presenti con `content_hash` non null
- `expert_approved = true` su tutte le righe importate
- `lang = 'it'`
- `type` = `multiple_choice` oppure `kprim` (non `multiple`)
- `notebook_id` non null sulle domande con `area` 1-9

Aprire `simulations` → verificare 13 righe con `legacy_id` popolato.

Aprire `simulation_questions` → verificare righe collegate.

- [ ] **Step 3: Rieseguire per verificare idempotenza**

```bash
node scripts/seed-tests.js
```

Expected: tutti i conteggi devono essere `0 nuove, N già esistenti`. Nessun errore di duplicati.

- [ ] **Step 4: Commit finale**

```bash
git commit --allow-empty -m "chore: seed-tests.js executed successfully, questions imported"
```
