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
  const rawArea = q.ruolo || simArea || 4
  const area = rawArea >= 1 && rawArea <= 9 ? rawArea : 4

  return {
    text: domanda,
    type,
    options: q.opzioni || q.options || {},
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

  const simId = await upsertSimulation(raw)
  console.log(`  ✓ Simulazione upserted (id: ${simId.slice(0, 8)}...)`)

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

    if (seenHashes.has(qData.content_hash)) {
      continue
    }
    seenHashes.add(qData.content_hash)

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
