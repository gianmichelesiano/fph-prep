# Study Material Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere materiale di studio (riassunti markdown + immagini) per topic/notebook all'app FPH Prep, con pagina "Studia" utente, link contestuale post-errore in Results, spiegazioni markdown per-domanda, admin UI editor, script import da filesystem generato da `notebooklm-py`, premium gating (free 2 topic/area).

**Architecture:** Tabella `notebook_contents` separata (1-a-N con `notebooks` via `lang`), contenuti in Supabase Storage bucket `summaries`. Frontend React + `react-markdown` per rendering. RLS enforce premium gate server-side. Script Node idempotente tramite `source_hash`. Zero test suite nel progetto — verifiche manuali browser + lint.

**Tech Stack:** React 19, Vite, Tailwind CSS (+ `@tailwindcss/typography`), react-router v7, Supabase (Postgres + Storage), `react-markdown`, `remark-gfm`, i18next.

**Spec:** `docs/superpowers/specs/2026-04-17-study-material-design.md`

---

## File Structure

**Nuovi:**
- `supabase/migrations/007_notebook_contents.sql`
- `supabase/migrations/008_summaries_storage.sql`
- `scripts/import-summaries.js`
- `src/lib/notebookContentsApi.js`
- `src/components/MarkdownView.jsx`
- `src/pages/Study.jsx`
- `src/pages/StudyArea.jsx`
- `src/pages/StudyTopic.jsx`
- `src/pages/admin/Contents.jsx`
- `src/pages/admin/ContentEditor.jsx`

**Modificati:**
- `package.json` (deps + script)
- `tailwind.config.js` (plugin typography)
- `src/App.jsx` (nuove route user + admin)
- `src/components/UserLayout.jsx` (nav "Studia")
- `src/components/admin/AdminLayout.jsx` (tab "Contents")
- `src/pages/Results.jsx` (render explanation + link ripassa)
- `src/locales/{it,de,fr,en}.json`
- `src/lib/api.js` (arricchire `fetchSession` con explanation + notebook fields — verificare se già presente)
- `.gitignore` (assicura `local/` ignorato)

---

## Task 1: Install dependencies and Tailwind typography plugin

**Files:**
- Modify: `package.json`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install react-markdown remark-gfm
npm install -D @tailwindcss/typography
```

Expected: updates `package.json` + `package-lock.json`, no errors.

- [ ] **Step 2: Enable typography plugin in tailwind config**

Open `tailwind.config.js` and add to `plugins` array:

```js
plugins: [require('@tailwindcss/typography')],
```

If `plugins` already exists, append. Keep rest of file untouched.

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: build completes without error.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tailwind.config.js
git commit -m "feat: add react-markdown + typography plugin for study material"
```

---

## Task 2: Migration 007 — notebook_contents table + RLS

**Files:**
- Create: `supabase/migrations/007_notebook_contents.sql`

- [ ] **Step 1: Write migration file**

Create `supabase/migrations/007_notebook_contents.sql`:

```sql
-- ============================================================
-- FPH Prep – notebook_contents (riassunti di studio)
-- ============================================================

create table public.notebook_contents (
  id uuid default gen_random_uuid() primary key,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  lang text not null default 'it' check (lang in ('it','de','fr','en')),
  content_md text not null,
  is_free boolean default false,
  source_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (notebook_id, lang)
);

create index idx_notebook_contents_notebook on public.notebook_contents(notebook_id);

alter table public.notebook_contents enable row level security;

-- Lettura: riga free visibile a chiunque autenticato;
-- riga non-free visibile solo a utenti premium o admin.
create policy "read_free_or_premium"
  on public.notebook_contents for select
  to authenticated
  using (
    is_free = true
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_premium = true or profiles.is_admin = true)
    )
  );

-- Write / update / delete: solo admin
create policy "admin_write"
  on public.notebook_contents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 2: Apply migration in Supabase**

Open Supabase Dashboard → SQL Editor → paste file content → Run.

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, 2 `CREATE POLICY` statements succeed.

- [ ] **Step 3: Verify schema**

In Supabase SQL Editor:
```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'notebook_contents'
order by ordinal_position;
```

Expected: 8 colonne (id, notebook_id, lang, content_md, is_free, source_hash, created_at, updated_at).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_notebook_contents.sql
git commit -m "feat: add notebook_contents migration for study material"
```

---

## Task 3: Migration 008 — Storage bucket `summaries`

**Files:**
- Create: `supabase/migrations/008_summaries_storage.sql`

- [ ] **Step 1: Write migration file**

Create `supabase/migrations/008_summaries_storage.sql`:

```sql
-- ============================================================
-- FPH Prep – Storage bucket 'summaries' (immagini riassunti)
-- ============================================================

-- Crea bucket pubblico (read)
insert into storage.buckets (id, name, public)
values ('summaries', 'summaries', true)
on conflict (id) do nothing;

-- Policy: chiunque legge dal bucket summaries
create policy "public_read_summaries"
  on storage.objects for select
  using (bucket_id = 'summaries');

-- Policy: solo admin inserisce/aggiorna/elimina
create policy "admin_write_summaries_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'summaries' and public.is_admin());

create policy "admin_write_summaries_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'summaries' and public.is_admin())
  with check (bucket_id = 'summaries' and public.is_admin());

create policy "admin_write_summaries_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'summaries' and public.is_admin());
```

- [ ] **Step 2: Apply migration in Supabase**

Supabase Dashboard → SQL Editor → paste → Run.

Expected: bucket created, 4 policies created.

- [ ] **Step 3: Verify bucket**

Dashboard → Storage → bucket `summaries` visibile, "Public bucket" badge presente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_summaries_storage.sql
git commit -m "feat: add summaries storage bucket + RLS policies"
```

---

## Task 4: Create API helpers — `src/lib/notebookContentsApi.js`

**Files:**
- Create: `src/lib/notebookContentsApi.js`

- [ ] **Step 1: Create the helpers file**

Create `src/lib/notebookContentsApi.js`:

```js
import { supabase } from './supabase'

// Fetch singolo contenuto by notebook key + lang.
// Ritorna { id, key, title, area_id, argomento, content: { content_md, is_free, updated_at } } o null.
export async function fetchContentByKey(key, lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento, notebook_contents!inner(content_md, is_free, updated_at, lang)')
    .eq('key', key)
    .eq('active', true)
    .eq('notebook_contents.lang', lang)
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  if (!data) return null
  const content = (data.notebook_contents || [])[0] || null
  return { ...data, notebook_contents: undefined, content }
}

// Lista notebooks (topic) per area, con flag hasContent + isFree.
export async function fetchNotebooksByArea(areaId, lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento, notebook_contents(is_free, updated_at, lang)')
    .eq('area_id', areaId)
    .eq('active', true)
    .order('title')
  if (error) throw error
  return (data || []).map(n => {
    const content = (n.notebook_contents || []).find(c => c.lang === lang)
    return {
      id: n.id,
      key: n.key,
      title: n.title,
      area_id: n.area_id,
      argomento: n.argomento,
      hasContent: !!content,
      isFree: content?.is_free ?? false,
      updatedAt: content?.updated_at ?? null,
    }
  })
}

// Conteggio per area: quanti notebook hanno contenuto nella lingua.
export async function fetchAreaCounts(lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('area_id, notebook_contents(lang)')
    .eq('active', true)
  if (error) throw error
  const counts = {}
  for (const n of data || []) {
    const has = (n.notebook_contents || []).some(c => c.lang === lang)
    if (n.area_id == null) continue
    if (!counts[n.area_id]) counts[n.area_id] = { total: 0, withContent: 0 }
    counts[n.area_id].total += 1
    if (has) counts[n.area_id].withContent += 1
  }
  return counts
}

// Admin: lista tutti i notebook con stato contenuto (per pagina /admin/contents).
export async function fetchAllNotebooksAdmin(lang = 'it') {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, key, title, area_id, argomento, active, notebook_contents(is_free, updated_at, lang)')
    .order('area_id')
    .order('title')
  if (error) throw error
  return (data || []).map(n => {
    const content = (n.notebook_contents || []).find(c => c.lang === lang)
    return {
      id: n.id,
      key: n.key,
      title: n.title,
      area_id: n.area_id,
      argomento: n.argomento,
      active: n.active,
      hasContent: !!content,
      isFree: content?.is_free ?? false,
      updatedAt: content?.updated_at ?? null,
    }
  })
}

// Admin: ottiene contenuto per editing (include content_md).
export async function fetchContentForEdit(notebookId, lang = 'it') {
  const [{ data: nb, error: nbErr }, { data: content, error: cErr }] = await Promise.all([
    supabase.from('notebooks').select('id, key, title, area_id, argomento').eq('id', notebookId).single(),
    supabase
      .from('notebook_contents')
      .select('content_md, is_free, updated_at')
      .eq('notebook_id', notebookId)
      .eq('lang', lang)
      .maybeSingle(),
  ])
  if (nbErr) throw nbErr
  if (cErr) throw cErr
  return { notebook: nb, content: content || { content_md: '', is_free: false, updated_at: null } }
}

// Admin: upsert contenuto.
export async function upsertContent({ notebook_id, lang = 'it', content_md, is_free }) {
  const { data, error } = await supabase
    .from('notebook_contents')
    .upsert(
      {
        notebook_id,
        lang,
        content_md,
        is_free,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'notebook_id,lang' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// Admin: upload immagine a summaries/<key>/<timestamp>-<filename>, ritorna URL pubblico.
export async function uploadSummaryImage(notebookKey, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${notebookKey}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('summaries').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('summaries').getPublicUrl(path)
  return data.publicUrl
}
```

- [ ] **Step 2: Verify lint**

Run:
```bash
npm run lint -- src/lib/notebookContentsApi.js
```

Expected: 0 errors (warnings ok).

- [ ] **Step 3: Commit**

```bash
git add src/lib/notebookContentsApi.js
git commit -m "feat: add notebookContentsApi helpers"
```

---

## Task 5: Create MarkdownView component

**Files:**
- Create: `src/components/MarkdownView.jsx`

- [ ] **Step 1: Write component**

Create `src/components/MarkdownView.jsx`:

```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownView({ content, className = '' }) {
  if (!content) return null
  return (
    <div className={`prose prose-sm md:prose-base max-w-none text-on-surface ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => (
            <img
              loading="lazy"
              className="rounded-md max-w-full h-auto my-4"
              {...props}
            />
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table className="text-sm" {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MarkdownView.jsx
git commit -m "feat: add MarkdownView component with GFM"
```

---

## Task 6: Import script — `scripts/import-summaries.js`

**Files:**
- Create: `scripts/import-summaries.js`
- Modify: `package.json` (aggiunge script)
- Modify: `.gitignore` (verifica `local/`)

- [ ] **Step 1: Ensure `.gitignore` has `local/`**

Open `.gitignore`. Se manca riga `local/` o `local`, aggiungila:

```
local/
```

(Il progetto ha già la cartella `local/` — deve essere ignorata per non committare contenuti da generazione.)

- [ ] **Step 2: Create import script**

Create `scripts/import-summaries.js`:

```js
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
// Fallback: prova anche .env.local
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
```

- [ ] **Step 3: Add npm script**

Apri `package.json`, aggiungi a `scripts`:

```json
"import-summaries": "node scripts/import-summaries.js"
```

(Mantieni gli altri script.)

- [ ] **Step 4: Manual smoke test (opzionale)**

Crea `local/summaries/interazioni/content.md` con contenuto minimo:

```md
# Test interazioni

Breve riassunto di test.
```

Esegui:
```bash
npm run import-summaries
```

Expected: log `[interazioni] created`, summary `created=1 updated=0 skipped=0 errors=0`.

Re-run:
```bash
npm run import-summaries
```

Expected: log `[interazioni] unchanged, skip`, summary `skipped=1`.

Verifica in Supabase: SELECT su `notebook_contents` WHERE `notebook_id` di `interazioni` → 1 riga.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-summaries.js package.json .gitignore
git commit -m "feat: add import-summaries script for bulk notebook content ingestion"
```

---

## Task 7: User page — `Study.jsx` (lista aree)

**Files:**
- Create: `src/pages/Study.jsx`

- [ ] **Step 1: Write Study page**

Create `src/pages/Study.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UserLayout from '../components/UserLayout'
import { AREAS } from '../data/areas'
import { fetchAreaCounts } from '../lib/notebookContentsApi'

export default function Study() {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAreaCounts('it')
      .then(c => { setCounts(c); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  const areasList = Object.entries(AREAS).map(([id, a]) => ({
    id: Number(id),
    name: a.name,
    color: a.color,
  }))

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-8">
          <h1 className="font-headline font-bold text-3xl text-on-surface">
            {t('study.title', 'Studia')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('study.subtitle', 'Riassunti per area e topic')}
          </p>
        </header>

        {loading ? (
          <div className="text-on-surface-variant">{t('common.loading', 'Caricamento...')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {areasList.map(area => {
              const c = counts[area.id] || { total: 0, withContent: 0 }
              return (
                <Link
                  key={area.id}
                  to={`/study/area/${area.id}`}
                  className="block p-5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color}`}>
                        Area {area.id}
                      </div>
                      <div className="text-on-surface font-semibold mt-2 truncate">
                        {area.name}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1">
                        {t('study.topicsCount', {
                          done: c.withContent,
                          total: c.total,
                          defaultValue: '{{done}}/{{total}} topic con contenuto',
                        })}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant">
                      chevron_right
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </UserLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Study.jsx
git commit -m "feat: add Study page listing areas with topic counts"
```

---

## Task 8: User page — `StudyArea.jsx` (lista topic in area)

**Files:**
- Create: `src/pages/StudyArea.jsx`

- [ ] **Step 1: Write StudyArea page**

Create `src/pages/StudyArea.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import { AREAS } from '../data/areas'
import { fetchNotebooksByArea } from '../lib/notebookContentsApi'

export default function StudyArea() {
  const { area_id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [notebooks, setNotebooks] = useState([])
  const [loading, setLoading] = useState(true)

  const areaId = Number(area_id)
  const area = AREAS[areaId]

  const isPremium = profile?.is_premium || profile?.is_admin

  useEffect(() => {
    if (!area) { setLoading(false); return }
    fetchNotebooksByArea(areaId, 'it')
      .then(list => { setNotebooks(list); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [areaId, area])

  if (!area) {
    return (
      <UserLayout>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <p className="text-on-surface-variant">{t('study.areaNotFound', 'Area non trovata.')}</p>
          <Link to="/study" className="text-primary underline">← {t('study.backToAreas', 'Torna alle aree')}</Link>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <Link to="/study" className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('study.backToAreas', 'Aree')}
        </Link>

        <header className="mb-6">
          <div className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${area.color}`}>
            Area {areaId}
          </div>
          <h1 className="font-headline font-bold text-3xl text-on-surface mt-2">
            {area.name}
          </h1>
        </header>

        {loading ? (
          <div className="text-on-surface-variant">{t('common.loading', 'Caricamento...')}</div>
        ) : notebooks.length === 0 ? (
          <p className="text-on-surface-variant">{t('study.noTopics', 'Nessun topic disponibile.')}</p>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {notebooks.map(n => {
              const locked = !n.isFree && !isPremium
              const disabled = !n.hasContent
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (disabled) return
                    if (locked) navigate('/upgrade')
                    else navigate(`/study/topic/${n.key}`)
                  }}
                  disabled={disabled}
                  className={`w-full text-left py-4 flex items-center justify-between gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container-lowest'} rounded-md px-3 transition-colors`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-on-surface">{n.title}</div>
                    {n.argomento && (
                      <div className="text-xs text-on-surface-variant truncate mt-0.5">{n.argomento}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.hasContent && (
                      <span className="text-[10px] text-outline uppercase tracking-wider">
                        {t('study.notReady', 'In preparazione')}
                      </span>
                    )}
                    {n.hasContent && n.isFree && (
                      <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10">
                        Free
                      </span>
                    )}
                    {n.hasContent && locked && (
                      <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                    )}
                    {n.hasContent && !locked && (
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </UserLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/StudyArea.jsx
git commit -m "feat: add StudyArea page listing topics with free/premium badges"
```

---

## Task 9: User page — `StudyTopic.jsx` (render markdown)

**Files:**
- Create: `src/pages/StudyTopic.jsx`

- [ ] **Step 1: Write StudyTopic page**

Create `src/pages/StudyTopic.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import UserLayout from '../components/UserLayout'
import MarkdownView from '../components/MarkdownView'
import { fetchContentByKey } from '../lib/notebookContentsApi'

export default function StudyTopic() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const isPremium = profile?.is_premium || profile?.is_admin

  useEffect(() => {
    fetchContentByKey(key, 'it')
      .then(res => {
        if (!res || !res.content) { setNotFound(true); setLoading(false); return }
        // Se non free e utente non premium -> redirect upgrade
        if (!res.content.is_free && !isPremium) {
          navigate('/upgrade', { replace: true })
          return
        }
        setData(res)
        setLoading(false)
      })
      .catch(err => { console.error(err); setNotFound(true); setLoading(false) })
  }, [key, isPremium, navigate])

  if (loading) {
    return (
      <UserLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse h-6 w-40 bg-surface-container-high rounded mb-4" />
          <div className="animate-pulse h-64 bg-surface-container-high rounded" />
        </div>
      </UserLayout>
    )
  }

  if (notFound || !data) {
    return (
      <UserLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-on-surface-variant mb-4">
            {t('study.topicNotFound', 'Topic non trovato o contenuto non ancora disponibile.')}
          </p>
          <Link to="/study" className="text-primary underline">
            ← {t('study.backToAreas', 'Torna alle aree')}
          </Link>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        <Link
          to={`/study/area/${data.area_id}`}
          className="text-sm text-primary flex items-center gap-1 mb-4"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('study.backToArea', 'Area {{id}}', { id: data.area_id })}
        </Link>

        <header className="mb-6">
          <h1 className="font-headline font-bold text-3xl text-on-surface">
            {data.title}
          </h1>
          {data.argomento && (
            <p className="text-sm text-on-surface-variant mt-2">{data.argomento}</p>
          )}
        </header>

        <article>
          <MarkdownView content={data.content.content_md} />
        </article>
      </div>
    </UserLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/StudyTopic.jsx
git commit -m "feat: add StudyTopic page with markdown render + premium gate"
```

---

## Task 10: i18n — add study keys in all 4 locales

**Files:**
- Modify: `src/locales/it.json`
- Modify: `src/locales/de.json`
- Modify: `src/locales/fr.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Identify existing nav section**

Apri `src/locales/it.json`. Trova sezione `"nav"`. Aggiungi chiave `"study"` e dove serve `"contents"` per admin nav.

- [ ] **Step 2: Add keys in `it.json`**

Dentro `"nav": { ... }` aggiungi:

```json
"study": "Studia"
```

Aggiungi nuova sezione top-level (o dove si incasellano altre pagine):

```json
"study": {
  "title": "Studia",
  "subtitle": "Riassunti per area e topic",
  "topicsCount": "{{done}}/{{total}} topic con contenuto",
  "backToAreas": "Torna alle aree",
  "backToArea": "Area {{id}}",
  "areaNotFound": "Area non trovata.",
  "noTopics": "Nessun topic disponibile.",
  "notReady": "In preparazione",
  "topicNotFound": "Topic non trovato o contenuto non ancora disponibile.",
  "reviewTopic": "Ripassa questo argomento"
}
```

Dentro `"admin.nav"` (o struttura equivalente esistente) aggiungi:

```json
"contents": "Contents"
```

Se non esiste `admin.nav`, mettilo dove si trovano label admin correnti.

- [ ] **Step 3: Add keys in `de.json`**

`nav.study`: `"Lernen"`

```json
"study": {
  "title": "Lernen",
  "subtitle": "Zusammenfassungen pro Gebiet und Thema",
  "topicsCount": "{{done}}/{{total}} Themen mit Inhalt",
  "backToAreas": "Zurück zu den Gebieten",
  "backToArea": "Gebiet {{id}}",
  "areaNotFound": "Gebiet nicht gefunden.",
  "noTopics": "Keine Themen verfügbar.",
  "notReady": "In Vorbereitung",
  "topicNotFound": "Thema nicht gefunden oder Inhalt noch nicht verfügbar.",
  "reviewTopic": "Dieses Thema wiederholen"
}
```

`admin.nav.contents`: `"Inhalte"`.

- [ ] **Step 4: Add keys in `fr.json`**

`nav.study`: `"Étudier"`

```json
"study": {
  "title": "Étudier",
  "subtitle": "Résumés par domaine et thème",
  "topicsCount": "{{done}}/{{total}} thèmes avec contenu",
  "backToAreas": "Retour aux domaines",
  "backToArea": "Domaine {{id}}",
  "areaNotFound": "Domaine introuvable.",
  "noTopics": "Aucun thème disponible.",
  "notReady": "En préparation",
  "topicNotFound": "Thème introuvable ou contenu non encore disponible.",
  "reviewTopic": "Réviser ce sujet"
}
```

`admin.nav.contents`: `"Contenus"`.

- [ ] **Step 5: Add keys in `en.json`**

`nav.study`: `"Study"`

```json
"study": {
  "title": "Study",
  "subtitle": "Summaries by area and topic",
  "topicsCount": "{{done}}/{{total}} topics with content",
  "backToAreas": "Back to areas",
  "backToArea": "Area {{id}}",
  "areaNotFound": "Area not found.",
  "noTopics": "No topics available.",
  "notReady": "Coming soon",
  "topicNotFound": "Topic not found or content not yet available.",
  "reviewTopic": "Review this topic"
}
```

`admin.nav.contents`: `"Contents"`.

- [ ] **Step 6: Validate JSON**

Run:
```bash
node -e "for (const f of ['it','de','fr','en']) { JSON.parse(require('fs').readFileSync('src/locales/'+f+'.json','utf8')); console.log(f,'ok') }"
```

Expected: `it ok`, `de ok`, `fr ok`, `en ok`.

- [ ] **Step 7: Commit**

```bash
git add src/locales/it.json src/locales/de.json src/locales/fr.json src/locales/en.json
git commit -m "feat: add study + admin contents i18n keys"
```

---

## Task 11: Add "Studia" link to UserLayout nav

**Files:**
- Modify: `src/components/UserLayout.jsx:14-19`

- [ ] **Step 1: Update NAV array**

Apri `src/components/UserLayout.jsx`. Trova:

```jsx
const NAV = [
  { to: '/',         label: t('nav.dashboard'),  icon: 'dashboard',         end: true },
  { to: '/stats',    label: t('nav.stats'),       icon: 'analytics' },
  { to: '/upgrade',  label: t('nav.upgrade'),     icon: 'workspace_premium' },
  { to: '/settings', label: t('nav.settings'),    icon: 'settings' },
]
```

Sostituisci con:

```jsx
const NAV = [
  { to: '/',         label: t('nav.dashboard'),  icon: 'dashboard',            end: true },
  { to: '/study',    label: t('nav.study'),       icon: 'menu_book' },
  { to: '/stats',    label: t('nav.stats'),       icon: 'analytics' },
  { to: '/upgrade',  label: t('nav.upgrade'),     icon: 'workspace_premium' },
  { to: '/settings', label: t('nav.settings'),    icon: 'settings' },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/components/UserLayout.jsx
git commit -m "feat: add Studia nav link in UserLayout"
```

---

## Task 12: Wire study routes in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports**

In cima a `src/App.jsx`, dopo `import Quiz...` aggiungi:

```jsx
import Study from './pages/Study'
import StudyArea from './pages/StudyArea'
import StudyTopic from './pages/StudyTopic'
```

- [ ] **Step 2: Add routes inside ProtectedRoute block**

Nel blocco:

```jsx
<Route element={<ProtectedRoute />}>
  <Route path="/quiz/:id" element={<Quiz />} />
  <Route path="/results/:id" element={<Results />} />
  <Route path="/stats" element={<Stats />} />
  <Route path="/settings" element={<Settings />} />
</Route>
```

Aggiungi prima di `</Route>`:

```jsx
<Route path="/study" element={<Study />} />
<Route path="/study/area/:area_id" element={<StudyArea />} />
<Route path="/study/topic/:key" element={<StudyTopic />} />
```

- [ ] **Step 3: Manual test**

Run:
```bash
npm run dev
```

Aprire `http://localhost:<port>/study` da utente loggato. Pagina Study mostra grid aree. Click su area → `/study/area/:id` mostra lista topic (vuota se non ci sono contenuti ancora importati, "In preparazione" per ogni notebook).

Se non ci sono contenuti importati:
- Run `npm run import-summaries` con almeno 1 cartella in `local/summaries/<key>/content.md`.
- Ricarica: vedi topic abilitato, badge Free se `meta.json` ha `{ "is_free": true }`.
- Click → `/study/topic/:key` rende markdown.

Ferma dev server.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire study routes in App router"
```

---

## Task 13: Admin page — `Contents.jsx` (lista notebook)

**Files:**
- Create: `src/pages/admin/Contents.jsx`

- [ ] **Step 1: Write admin Contents page**

Create `src/pages/admin/Contents.jsx`:

```jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { AREAS } from '../../data/areas'
import { fetchAllNotebooksAdmin } from '../../lib/notebookContentsApi'

export default function AdminContents() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterArea, setFilterArea] = useState('all')

  useEffect(() => {
    fetchAllNotebooksAdmin('it')
      .then(data => { setItems(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (filterArea === 'all') return items
    return items.filter(i => i.area_id === Number(filterArea))
  }, [items, filterArea])

  const stats = useMemo(() => {
    const total = items.length
    const withContent = items.filter(i => i.hasContent).length
    return { total, withContent }
  }, [items])

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">Contents</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {stats.withContent}/{stats.total} notebook con contenuto (IT)
            </p>
          </div>
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            className="px-3 py-2 bg-surface-container rounded-lg text-sm"
          >
            <option value="all">Tutte le aree</option>
            {Object.entries(AREAS).map(([id, a]) => (
              <option key={id} value={id}>Area {id} — {a.name}</option>
            ))}
          </select>
        </header>

        {loading ? (
          <div className="text-on-surface-variant">Caricamento...</div>
        ) : (
          <div className="rounded-xl bg-surface-container-lowest overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-left text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">Key</th>
                  <th className="px-4 py-3 font-semibold">Titolo</th>
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 font-semibold">Stato</th>
                  <th className="px-4 py-3 font-semibold">Free</th>
                  <th className="px-4 py-3 font-semibold">Aggiornato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map(n => (
                  <tr
                    key={n.id}
                    className="hover:bg-surface-container-low cursor-pointer"
                    onClick={() => navigate(`/admin/contents/${n.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{n.key}</td>
                    <td className="px-4 py-3 text-on-surface">{n.title}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{n.area_id}</td>
                    <td className="px-4 py-3">
                      {n.hasContent ? (
                        <span className="text-xs font-semibold text-green-700">✓ Pronto</span>
                      ) : (
                        <span className="text-xs text-outline">✗ Vuoto</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {n.hasContent && n.isFree ? (
                        <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10">Free</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('it-IT') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/Contents.jsx
git commit -m "feat: add admin Contents page listing notebooks with status"
```

---

## Task 14: Admin page — `ContentEditor.jsx`

**Files:**
- Create: `src/pages/admin/ContentEditor.jsx`

- [ ] **Step 1: Write ContentEditor**

Create `src/pages/admin/ContentEditor.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkdownView from '../../components/MarkdownView'
import {
  fetchContentForEdit,
  upsertContent,
  uploadSummaryImage,
} from '../../lib/notebookContentsApi'

export default function ContentEditor() {
  const { notebook_id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const [notebook, setNotebook] = useState(null)
  const [md, setMd] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetchContentForEdit(notebook_id, 'it')
      .then(({ notebook, content }) => {
        setNotebook(notebook)
        setMd(content.content_md || '')
        setIsFree(content.is_free || false)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setMsg({ type: 'error', text: err.message })
        setLoading(false)
      })
  }, [notebook_id])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await upsertContent({
        notebook_id,
        lang: 'it',
        content_md: md,
        is_free: isFree,
      })
      setMsg({ type: 'success', text: 'Salvato.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !notebook) return
    setUploading(true)
    setMsg(null)
    try {
      const url = await uploadSummaryImage(notebook.key, file)
      const insert = `\n![${file.name}](${url})\n`
      const ta = textareaRef.current
      if (ta) {
        const pos = ta.selectionStart
        const next = md.slice(0, pos) + insert + md.slice(pos)
        setMd(next)
      } else {
        setMd(md + insert)
      }
      setMsg({ type: 'success', text: 'Immagine caricata.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">Caricamento...</div>
      </AdminLayout>
    )
  }

  if (!notebook) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p>Notebook non trovato.</p>
          <Link to="/admin/contents" className="text-primary underline">← Torna alla lista</Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Link to="/admin/contents" className="text-sm text-primary flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Contents
        </Link>

        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">{notebook.title}</h1>
            <p className="text-xs text-on-surface-variant font-mono mt-1">{notebook.key} · Area {notebook.area_id}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFree}
                onChange={e => setIsFree(e.target.checked)}
              />
              is_free
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 rounded-lg bg-surface-container text-sm hover:bg-surface-container-high disabled:opacity-50"
            >
              {uploading ? 'Upload...' : '📎 Immagine'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </header>

        {msg && (
          <div className={`mb-4 px-3 py-2 rounded text-sm ${msg.type === 'error' ? 'bg-error-container text-error' : 'bg-tertiary/10 text-tertiary'}`}>
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-on-surface-variant uppercase tracking-wider">Markdown</label>
            <textarea
              ref={textareaRef}
              value={md}
              onChange={e => setMd(e.target.value)}
              spellCheck={false}
              className="mt-1 w-full h-[70vh] p-4 bg-surface-container-lowest rounded-lg font-mono text-sm resize-none"
              placeholder="# Titolo\n\nContenuto markdown..."
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant uppercase tracking-wider">Anteprima</label>
            <div className="mt-1 w-full h-[70vh] p-4 bg-surface-container-lowest rounded-lg overflow-y-auto">
              <MarkdownView content={md} />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/ContentEditor.jsx
git commit -m "feat: add admin ContentEditor with markdown + image upload"
```

---

## Task 15: Add "Contents" tab to AdminLayout nav

**Files:**
- Modify: `src/components/admin/AdminLayout.jsx:4-11`

- [ ] **Step 1: Update NAV array**

Apri `src/components/admin/AdminLayout.jsx`. Trova:

```jsx
const NAV = [
  { to: '/admin',             label: 'Dashboard',        icon: 'dashboard',     end: true },
  { to: '/admin/users',       label: 'User Management',  icon: 'group' },
  { to: '/admin/questions',   label: 'Question Bank',    icon: 'database' },
  { to: '/admin/simulations', label: 'Simulations',      icon: 'assignment' },
  { to: '/admin/catalog',     label: 'Catalog',          icon: 'category' },
  { to: '/admin/generate',    label: 'AI Generate',      icon: 'auto_awesome' },
]
```

Sostituisci con:

```jsx
const NAV = [
  { to: '/admin',             label: 'Dashboard',        icon: 'dashboard',     end: true },
  { to: '/admin/users',       label: 'User Management',  icon: 'group' },
  { to: '/admin/questions',   label: 'Question Bank',    icon: 'database' },
  { to: '/admin/simulations', label: 'Simulations',      icon: 'assignment' },
  { to: '/admin/contents',    label: 'Contents',         icon: 'menu_book' },
  { to: '/admin/catalog',     label: 'Catalog',          icon: 'category' },
  { to: '/admin/generate',    label: 'AI Generate',      icon: 'auto_awesome' },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminLayout.jsx
git commit -m "feat: add Contents tab in admin nav"
```

---

## Task 16: Wire admin contents routes in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports**

Aggiungi:

```jsx
import AdminContents from './pages/admin/Contents'
import AdminContentEditor from './pages/admin/ContentEditor'
```

- [ ] **Step 2: Add routes in AdminRoute block**

Nel blocco `<Route element={<AdminRoute />}>...</Route>`, prima del `</Route>` finale, aggiungi:

```jsx
<Route path="/admin/contents" element={<AdminContents />} />
<Route path="/admin/contents/:notebook_id" element={<AdminContentEditor />} />
```

- [ ] **Step 3: Manual test**

Run:
```bash
npm run dev
```

Come admin user, naviga a `/admin/contents`:
- Lista notebook visibile, filtro area funziona.
- Click su una riga → apre editor per quel notebook_id.

In editor:
- Scrivi del markdown nella textarea → preview live aggiorna.
- Toggle `is_free` → stato riflette.
- Upload immagine → URL pubblico si inserisce al cursore, preview mostra immagine.
- Click Salva → banner "Salvato.".
- Reload pagina → contenuto persistito.

Ferma dev server.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire admin contents routes"
```

---

## Task 17: Update `Results.jsx` — render explanation markdown + link ripassa

**Files:**
- Modify: `src/pages/Results.jsx`
- Check/Modify: `src/lib/api.js` (funzione `fetchSession`)

- [ ] **Step 1: Verify `fetchSession` ritorna `explanation` e `notebook_id`**

Apri `src/lib/api.js` e individua `fetchSession`. Serve che restituisca per ogni question: `id, text, type, options, correct_answer, explanation, notebook_id`, e opzionalmente `notebooks.key`, `notebooks.title`.

Se la select corrente NON include `explanation` o `notebook_id`, estendi il join. Esempio target della select nested di `questions`:

```js
questions:question_id (
  id, text, type, options, correct_answer, explanation, area, notebook_id,
  notebook:notebook_id ( key, title )
)
```

Se la query attuale usa un'altra forma (es. array denormalizzato), aggiungi i campi necessari in modo che ogni `question` oggetto abbia `explanation`, `notebook_id`, `notebook: { key, title }` (o equivalente).

Test: console.log di `session.questions[0]` dopo caricamento deve includere `explanation` e (se domanda ha notebook_id) `notebook.key` + `notebook.title`.

- [ ] **Step 2: Also fetch notebook content flags for gating**

In `Results.jsx` useEffect: dopo `fetchSession`, caricare in batch gli `is_free` dei `notebook_contents` per i `notebook_id` coinvolti:

```js
// In Results.jsx, in useEffect dopo setSession
async function loadContentFlags(session) {
  const nbIds = Array.from(
    new Set(
      (session?.questions || [])
        .map(q => q.notebook_id)
        .filter(Boolean)
    )
  )
  if (nbIds.length === 0) return {}
  const { data } = await supabase
    .from('notebook_contents')
    .select('notebook_id, is_free')
    .in('notebook_id', nbIds)
    .eq('lang', 'it')
  const map = {}
  for (const row of data || []) map[row.notebook_id] = { isFree: row.is_free }
  return map
}
```

Aggiungi state `const [contentFlags, setContentFlags] = useState({})`. Dopo `setSession(data)` chiama `loadContentFlags(data).then(setContentFlags)`.

Importa `supabase` da `../lib/supabase` in `Results.jsx`.

- [ ] **Step 3: Add review section (revisione risposte)**

In `Results.jsx`, dopo il breakdown area esistente, aggiungi:

```jsx
import MarkdownView from '../components/MarkdownView'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
// + gli altri già presenti

// all'inizio del componente, dopo `const [session, setSession] = useState(null)`:
const { profile } = useAuth()
const { t } = useTranslation()
const isPremium = profile?.is_premium || profile?.is_admin
```

Aggiungi nel render, dopo la sezione esistente:

```jsx
{/* Revisione risposte */}
<section className="mt-10 max-w-3xl mx-auto px-4">
  <h2 className="font-headline font-bold text-xl text-on-surface mb-4">
    {t('results.reviewTitle', 'Revisione risposte')}
  </h2>
  <ul className="space-y-6">
    {(questions || []).map((q, idx) => {
      const userAns = (answers || {})[q.id]
      const correct = q.correct_answer
      const isRight =
        q.type === 'kprim'
          ? JSON.stringify(userAns) === JSON.stringify(correct)
          : userAns === correct
      const nb = q.notebook || null
      const flags = contentFlags[q.notebook_id] || null
      const topicLocked = flags && !flags.isFree && !isPremium
      return (
        <li
          key={q.id}
          className={`p-4 rounded-xl ${isRight ? 'bg-surface-container-lowest' : 'bg-error-container/30'}`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider mb-2">
            <span className="text-on-surface-variant">{t('results.question', 'Domanda')} {idx + 1}</span>
            {isRight ? (
              <span className="text-green-700 font-semibold">✓</span>
            ) : (
              <span className="text-error font-semibold">✗</span>
            )}
          </div>
          <p className="text-sm text-on-surface mb-3 whitespace-pre-wrap">{q.text}</p>
          {q.explanation && (
            <div className="mt-2">
              <MarkdownView content={q.explanation} className="prose-sm" />
            </div>
          )}
          {nb && flags && (
            topicLocked ? (
              <button
                onClick={() => navigate('/upgrade')}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                {t('study.reviewTopic', 'Ripassa questo argomento')} — {nb.title} (Premium)
              </button>
            ) : (
              <button
                onClick={() => navigate(`/study/topic/${nb.key}`)}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                {t('study.reviewTopic', 'Ripassa questo argomento')} — {nb.title}
              </button>
            )
          )}
        </li>
      )
    })}
  </ul>
</section>
```

- [ ] **Step 4: Add i18n keys for results section**

In ogni `src/locales/{it,de,fr,en}.json`, sezione `"results"`, aggiungi:

IT:
```json
"reviewTitle": "Revisione risposte",
"question": "Domanda"
```

DE:
```json
"reviewTitle": "Antwortprüfung",
"question": "Frage"
```

FR:
```json
"reviewTitle": "Révision des réponses",
"question": "Question"
```

EN:
```json
"reviewTitle": "Answer review",
"question": "Question"
```

- [ ] **Step 5: Manual test**

Run `npm run dev`. Esegui un quiz breve (es. simulazione free), sottometti. In Results:
- Sezione "Revisione risposte" appare.
- Domande con explanation → markdown renderizzato.
- Domande con `notebook_id` → bottone "Ripassa: <titolo>".
- Se topic è free → click naviga a `/study/topic/:key`.
- Se topic è premium e utente non premium → bottone mostra lock + naviga a `/upgrade`.

Ferma dev server.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Results.jsx src/lib/api.js src/locales/it.json src/locales/de.json src/locales/fr.json src/locales/en.json
git commit -m "feat: Results review section with explanation markdown + ripassa topic link"
```

---

## Task 18: Final end-to-end verification

**Files:** nessuno (manual verification).

- [ ] **Step 1: Build check**

Run:
```bash
npm run build
```

Expected: build completes, no errors.

- [ ] **Step 2: Lint check**

Run:
```bash
npm run lint
```

Expected: 0 errors (warnings tollerati se pre-esistenti).

- [ ] **Step 3: Seed import**

Genera 2 cartelle di esempio in `local/summaries/`:

`local/summaries/interazioni/content.md`:
```md
# Interazioni rilevanti

Breve riassunto con **bold** e una lista:

- polifarmacia
- controindicazioni
- dosaggio
```

`local/summaries/interazioni/meta.json`:
```json
{ "is_free": true, "lang": "it" }
```

`local/summaries/antibiotici/content.md`:
```md
# Antibiotici

Contenuto premium di test.
```

(Omettere meta.json → default non-free.)

Run:
```bash
npm run import-summaries
```

Expected: `created=2`, 0 errori.

Re-run: `skipped=2`, 0 errori.

- [ ] **Step 4: User flow — free user**

Crea/usa account non-premium. Login. Naviga:

1. Sidebar → "Studia" → `/study`: grid aree visibile.
2. Area 1 (Validazione ricette): "interazioni" con badge Free, "deprescrizione" con "In preparazione" (non importato).
3. Click "interazioni" → render markdown OK.
4. Area 4: "antibiotici" con lucchetto. Click → redirect `/upgrade`.

- [ ] **Step 5: User flow — premium user**

Upgrade profilo a `is_premium=true` (via Supabase Dashboard o `/admin/users`).

1. "antibiotici" ora accessibile senza redirect.
2. Render markdown OK.

- [ ] **Step 6: Quiz → Results flow**

Esegui una simulazione che include almeno 1 domanda con `notebook_id=interazioni` (o simile). Sottometti.

1. Results: sezione "Revisione risposte" presente.
2. Ogni domanda mostra explanation se `questions.explanation` non vuoto (markdown renderizzato).
3. Bottone "Ripassa: Interazioni rilevanti" se `notebook_id` presente.
4. Click → naviga a `/study/topic/interazioni`.

- [ ] **Step 7: Admin flow**

Come admin:
1. Sidebar admin → "Contents" → `/admin/contents`.
2. Lista notebook con stato ✓/✗.
3. Filtro per area funziona.
4. Click riga "interazioni" → editor mostra markdown caricato.
5. Edita markdown → preview aggiorna live.
6. Click 📎 Immagine → seleziona file → inserisce `![name](URL)` al cursore → preview mostra immagine.
7. Toggle `is_free` → Salva → banner success.
8. Reload pagina → nuovo contenuto + flag persistiti.

- [ ] **Step 8: RLS verification**

Da client anonimo (senza login, in Supabase Dashboard SQL Editor `set role anon;`):

```sql
select count(*) from public.notebook_contents;
```

Expected: errore o 0 righe (authenticated-only).

Come utente loggato non premium:
```sql
select notebook_id, is_free from public.notebook_contents;
```

Expected: solo righe con `is_free = true`.

Come utente premium: tutte le righe.

- [ ] **Step 9: Final commit (se ci sono fix)**

Se i passi precedenti hanno rivelato piccoli fix, committarli con messaggio descrittivo. Altrimenti skip.

- [ ] **Step 10: Close the loop**

Aggiorna il file spec `docs/superpowers/specs/2026-04-17-study-material-design.md` cambiando lo status da `Draft` a `Implemented` con data. Commit:

```bash
git add docs/superpowers/specs/2026-04-17-study-material-design.md
git commit -m "docs: mark study-material spec as implemented"
```

---

## Notes on testing / TDD

Il progetto non ha framework di test (`package.json` scripts non includono test runner). Questo piano usa **verifiche manuali browser + lint + build** come gate di qualità, coerenti con le convenzioni esistenti. Introdurre vitest è fuori scope.

Unica eccezione possibile: se l'helper `rewriteMarkdown` in `import-summaries.js` genera confusione, aggiungere un piccolo test standalone `scripts/test-rewrite.js` — opzionale, non pianificato qui.

---

## Open follow-ups (non bloccanti)

- Multilingua contenuti DE/FR/EN: schema predisposto (`lang` su `notebook_contents`). Aggiungere cartelle `local/summaries-de/` ecc. e flag CLI allo script quando serve.
- Ricerca full-text sui contenuti: indice pgtrgm / tsvector quando `notebook_contents` avrà molti record.
- Migrazione script image-rewrite a regex per supportare `../images/`, `images/`, ecc. se NotebookLM cambia output.
- Rate limit upload immagini (admin abuse sconsigliato ma basso rischio).
