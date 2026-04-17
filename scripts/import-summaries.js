#!/usr/bin/env node
/**
 * import-summaries.js
 *
 * Legge local/summaries/<notebook_key>/content.md (+ images/ + meta.json opzionale)
 * e popola la tabella notebook_contents + Supabase Storage bucket 'summaries'.
 *
 * Idempotente: calcola sha256 del markdown finale e skippa se invariato.
 *
 * Usage:
 *   npm run import-summaries
 *
 * Env richieste in .env (o .env.local):
 *   - VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

config()
config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = join(__dirname, '../local/summaries')
const BUCKET = 'summaries'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false },
})

function sha256(s) {
  return createHash('sha256').update(s).digest('hex')
}

function contentTypeFor(file) {
  const ext = extname(file).slice(1).toLowerCase()
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return map[ext] || 'application/octet-stream'
}

async function uploadImages(key, imagesDir) {
  const map = {}
  if (!existsSync(imagesDir)) return map
  for (const file of readdirSync(imagesDir)) {
    const full = join(imagesDir, file)
    if (!statSync(full).isFile()) continue
    const remotePath = `${key}/${file}`
    const buffer = readFileSync(full)
    const { error } = await supabase.storage.from(BUCKET).upload(remotePath, buffer, {
      contentType: contentTypeFor(file),
      upsert: true,
    })
    if (error) throw new Error(`upload failed ${remotePath}: ${error.message}`)
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(remotePath)
    map[file] = data.publicUrl
  }
  return map
}

function rewriteMarkdown(md, urlMap) {
  let out = md
  for (const [filename, url] of Object.entries(urlMap)) {
    const needle = `./images/${filename}`
    out = out.split(needle).join(url)
  }
  return out
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`Source dir missing: ${SOURCE_DIR}`)
    process.exit(1)
  }

  const folders = readdirSync(SOURCE_DIR).filter(f =>
    statSync(join(SOURCE_DIR, f)).isDirectory()
  )

  let created = 0, updated = 0, skipped = 0, errors = 0

  for (const key of folders) {
    const folder = join(SOURCE_DIR, key)
    const mdPath = join(folder, 'content.md')
    if (!existsSync(mdPath)) {
      console.warn(`[${key}] no content.md, skip`)
      continue
    }
    try {
      const { data: nb, error: nbErr } = await supabase
        .from('notebooks')
        .select('id')
        .eq('key', key)
        .maybeSingle()
      if (nbErr) throw nbErr
      if (!nb) {
        console.warn(`[${key}] no notebook row in DB, skip`)
        continue
      }

      const metaPath = join(folder, 'meta.json')
      const meta = existsSync(metaPath)
        ? JSON.parse(readFileSync(metaPath, 'utf8'))
        : {}
      const isFree = meta.is_free === true
      const lang = meta.lang || 'it'

      const rawMd = readFileSync(mdPath, 'utf8')
      const urlMap = await uploadImages(key, join(folder, 'images'))
      const finalMd = rewriteMarkdown(rawMd, urlMap)
      const hash = sha256(finalMd)

      const { data: existing, error: exErr } = await supabase
        .from('notebook_contents')
        .select('id, source_hash, is_free')
        .eq('notebook_id', nb.id)
        .eq('lang', lang)
        .maybeSingle()
      if (exErr) throw exErr

      if (existing && existing.source_hash === hash && existing.is_free === isFree) {
        skipped++
        console.log(`[${key}] unchanged, skip`)
        continue
      }

      const { error: upErr } = await supabase
        .from('notebook_contents')
        .upsert(
          {
            notebook_id: nb.id,
            lang,
            content_md: finalMd,
            is_free: isFree,
            source_hash: hash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'notebook_id,lang' }
        )
      if (upErr) throw upErr

      if (existing) {
        updated++
        console.log(`[${key}] updated`)
      } else {
        created++
        console.log(`[${key}] created`)
      }
    } catch (err) {
      errors++
      console.error(`[${key}] error:`, err.message)
    }
  }

  console.log(
    `\nDone. created=${created} updated=${updated} skipped=${skipped} errors=${errors}`
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
