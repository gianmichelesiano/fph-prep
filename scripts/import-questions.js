#!/usr/bin/env node
/**
 * import-questions.js
 * Imports all JSON test files from src/data/tests/ into Supabase.
 *
 * Usage:
 *   node scripts/import-questions.js
 *
 * Requires:
 *   - VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   - npm install @supabase/supabase-js dotenv
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

config() // load .env

const __dirname = dirname(fileURLToPath(import.meta.url))
const TESTS_DIR = join(__dirname, '../src/data/tests')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Free simulations (first 2 alphabetically by legacy_id)
const FREE_LIMIT = 2

function normalizeQuestion(q, area) {
  const tipo = q.tipo || q.type
  if (tipo === 'multipla_scelta' || tipo === 'multiple') {
    const opzioni = q.opzioni || {}
    const options = {
      A: opzioni.A || opzioni['1'] || '',
      B: opzioni.B || opzioni['2'] || '',
      C: opzioni.C || opzioni['3'] || '',
      D: opzioni.D || opzioni['4'] || '',
    }
    const rc = q.risposta_corretta || q.correct || 'A'
    return {
      type: 'multiple',
      text: q.domanda || q.text || '',
      options,
      correct_answer: typeof rc === 'string' ? rc.toUpperCase().charAt(0) : 'A',
      explanation: q.motivazione || q.motivation || '',
      area: area || q.ruolo || 4,
      topic: q.tema || q.topic || null,
      lang: 'it',
      status: 'active',
    }
  } else if (tipo === 'kprim' || tipo === 'truefalse') {
    const opzioni = q.opzioni || {}
    const rc = q.risposta_corretta || q.correct || 'VVVV'
    // Build items: 4 statements with true/false
    let items
    if (typeof rc === 'string' && rc.length === 4) {
      // "VVFV" format
      items = [1, 2, 3, 4].map((num, i) => ({
        text: opzioni[String(num)] || opzioni[['A', 'B', 'C', 'D'][i]] || '',
        correct: rc[i] === 'V',
      }))
    } else if (Array.isArray(q.items)) {
      items = q.items
    } else {
      items = [1, 2, 3, 4].map((num) => ({
        text: opzioni[String(num)] || '',
        correct: true,
      }))
    }
    return {
      type: 'kprim',
      text: q.domanda || q.text || '',
      options: { items },
      correct_answer: JSON.stringify(items.map(it => it.correct ? 'V' : 'F')),
      explanation: q.motivazione || q.motivation || '',
      area: area || q.ruolo || 4,
      topic: q.tema || q.topic || null,
      lang: 'it',
      status: 'active',
    }
  }
  return null
}

async function importFile(filePath, isFree) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))

  // Determine simulation metadata
  const legacyId = raw.id || raw.esame?.replace(/\s+/g, '-').toLowerCase() || null
  const title = raw.title || raw.esame || raw.titolo || legacyId || 'Simulazione'
  const area = raw.area || raw.distribuzione_ruoli ? Object.keys(raw.distribuzione_ruoli || {})[0]?.replace('ruolo_', '') : null
  const timer = raw.timer || raw.durata_minuti || 90
  const questions = raw.questions || raw.domande || []

  if (!questions.length) {
    console.warn(`⚠️  ${filePath}: no questions found`)
    return
  }

  // Create simulation
  const { data: sim, error: simError } = await supabase
    .from('simulations')
    .insert({
      title,
      area: Number(area) || 4,
      timer: Number(timer) || 90,
      lang: 'it',
      is_free: isFree,
      legacy_id: legacyId,
      status: 'active',
    })
    .select()
    .single()

  if (simError) {
    console.error(`❌ Error creating simulation for ${filePath}:`, simError.message)
    return
  }

  console.log(`✅ Created simulation: "${title}" (${questions.length} questions, free=${isFree})`)

  // Insert questions and link to simulation
  let position = 0
  for (const q of questions) {
    const normalized = normalizeQuestion(q, Number(area) || 4)
    if (!normalized) {
      console.warn(`  ⚠️  Skipped question (unknown type)`)
      continue
    }

    const { data: qRow, error: qError } = await supabase
      .from('questions')
      .insert(normalized)
      .select('id')
      .single()

    if (qError) {
      console.error(`  ❌ Error inserting question:`, qError.message)
      continue
    }

    const { error: linkError } = await supabase
      .from('simulation_questions')
      .insert({ simulation_id: sim.id, question_id: qRow.id, position })

    if (linkError) {
      console.error(`  ❌ Error linking question:`, linkError.message)
    }
    position++
  }

  console.log(`   → ${position} questions linked`)
}

async function main() {
  console.log('🚀 FPH Prep — Importing questions to Supabase\n')

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }

  const files = readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()

  console.log(`Found ${files.length} JSON files in ${TESTS_DIR}\n`)

  for (let i = 0; i < files.length; i++) {
    const filePath = join(TESTS_DIR, files[i])
    const isFree = i < FREE_LIMIT
    console.log(`[${i + 1}/${files.length}] ${files[i]}${isFree ? ' (FREE)' : ''}`)
    await importFile(filePath, isFree)
    console.log()
  }

  console.log('✨ Import complete!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
