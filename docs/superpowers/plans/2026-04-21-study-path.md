# Study Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and display a free-navigation study path (study guide + flashcards + mind map) per notebook using NotebookLM, stored in Supabase.

**Architecture:** Extend the existing `artifacts` + `generation_jobs` tables with new types. Admin FastAPI backend handles generation via NotebookLM Python API. React frontend reads artifacts directly from Supabase and renders them as interactive cards inside `StudyTopic.jsx`.

**Tech Stack:** Python/FastAPI (admin backend), `notebooklm-py` async client, Supabase REST (httpx), React + Tailwind (frontend), Supabase JS client (frontend reads).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `admin/sql/003_extend_artifact_types.sql` | Extend type constraints |
| MODIFY | `admin/app/db/supabase.py` | Add `insert` method to `SupabaseRestClient` |
| CREATE | `admin/app/services/study_path_service.py` | NotebookLM generation + Supabase save |
| CREATE | `admin/app/routers/api_study_path.py` | `POST /api/study-path/{id}/generate`, `GET /api/study-path/{id}` |
| MODIFY | `admin/app/dependencies.py` | Add `get_study_path_service` factory |
| MODIFY | `admin/app/main.py` | Register `api_study_path` router |
| CREATE | `admin/tests/test_supabase_insert.py` | Unit test for `insert` method |
| CREATE | `admin/tests/test_study_path_service.py` | Unit test for service logic |
| MODIFY | `src/lib/notebookContentsApi.js` | Add `fetchStudyPath(notebookId)` |
| MODIFY | `src/pages/StudyTopic.jsx` | Add study path cards section |

---

### Task 1: SQL migration — extend type constraints

**Files:**
- Create: `admin/sql/003_extend_artifact_types.sql`

- [ ] **Step 1: Create migration file**

```sql
-- admin/sql/003_extend_artifact_types.sql
alter table public.artifacts drop constraint if exists artifacts_type_check;
alter table public.artifacts add constraint artifacts_type_check
  check (type in ('summary','quiz','iconography','study_guide','flashcards','mind_map'));

alter table public.generation_jobs drop constraint if exists generation_jobs_type_check;
alter table public.generation_jobs add constraint generation_jobs_type_check
  check (type in ('summary','quiz','iconography','study_guide','flashcards','mind_map'));
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open Supabase dashboard → SQL editor → paste and run the migration.
Expected: no errors, constraints updated.

- [ ] **Step 3: Commit**

```bash
git add admin/sql/003_extend_artifact_types.sql
git commit -m "feat(db): extend artifact and generation_job type constraints for study path"
```

---

### Task 2: Add `insert` method to `SupabaseRestClient`

**Files:**
- Modify: `admin/app/db/supabase.py`
- Create: `admin/tests/test_supabase_insert.py`

- [ ] **Step 1: Write the failing test**

Create `admin/tests/__init__.py` (empty) and `admin/tests/test_supabase_insert.py`:

```python
# admin/tests/test_supabase_insert.py
from unittest.mock import MagicMock, patch
import pytest
from app.db.supabase import SupabaseRestClient, SupabaseRequestError


def make_client():
    return SupabaseRestClient(base_url="https://x.supabase.co", api_key="test-key")


def test_insert_returns_created_row():
    client = make_client()
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.content = b'[{"id": "abc", "type": "study_guide"}]'
    mock_response.json.return_value = [{"id": "abc", "type": "study_guide"}]

    with patch("httpx.Client") as mock_httpx:
        mock_httpx.return_value.__enter__.return_value.post.return_value = mock_response
        result = client.insert("artifacts", {"type": "study_guide", "notebook_id": "nb1", "title": "t", "format": "markdown", "content": {}})

    assert result == {"id": "abc", "type": "study_guide"}


def test_insert_raises_on_error():
    client = make_client()
    mock_response = MagicMock()
    mock_response.status_code = 422
    mock_response.text = "Unprocessable"

    with patch("httpx.Client") as mock_httpx:
        mock_httpx.return_value.__enter__.return_value.post.return_value = mock_response
        with pytest.raises(SupabaseRequestError):
            client.insert("artifacts", {"type": "bad"})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gianmichele/Development/Personal/fph-prep/admin
source venv/bin/activate
python -m pytest tests/test_supabase_insert.py -v
```

Expected: `AttributeError: 'SupabaseRestClient' object has no attribute 'insert'`

- [ ] **Step 3: Add `insert` and `update` methods to `SupabaseRestClient`**

In `admin/app/db/supabase.py`, add after the `select` method:

```python
def insert(
    self,
    table: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{self.base_url.rstrip('/')}/rest/v1/{table}"
    headers = {**self._headers(), "Content-Type": "application/json", "Prefer": "return=representation"}
    with httpx.Client(timeout=self.timeout) as client:
        response = client.post(url, headers=headers, json=payload)
    if response.status_code >= 400:
        raise SupabaseRequestError(
            f"Supabase insert failed ({response.status_code}): {response.text}"
        )
    return response.json()[0]

def update(
    self,
    table: str,
    filters: dict[str, str],
    payload: dict[str, Any],
) -> None:
    params: dict[str, str] = {**filters}
    url = f"{self.base_url.rstrip('/')}/rest/v1/{table}?{urlencode(params)}"
    headers = {**self._headers(), "Content-Type": "application/json"}
    with httpx.Client(timeout=self.timeout) as client:
        response = client.patch(url, headers=headers, json=payload)
    if response.status_code >= 400:
        raise SupabaseRequestError(
            f"Supabase update failed ({response.status_code}): {response.text}"
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_supabase_insert.py -v
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add admin/app/db/supabase.py admin/tests/__init__.py admin/tests/test_supabase_insert.py
git commit -m "feat(db): add insert and update methods to SupabaseRestClient"
```

---

### Task 3: `study_path_service.py`

**Files:**
- Create: `admin/app/services/study_path_service.py`
- Create: `admin/tests/test_study_path_service.py`

- [ ] **Step 1: Write the failing test**

```python
# admin/tests/test_study_path_service.py
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.study_path_service import StudyPathService


def make_service():
    db = MagicMock()
    db.insert.return_value = {"id": "job-1"}
    db.update.return_value = None
    return StudyPathService(db_client=db, notebooks_yaml_path="notebooks.yaml")


def test_get_notebooklm_id_found(tmp_path):
    yaml_content = "vaccini:\n  id: abc-123\n  nome: Vaccini\n  argomento: vaccini\n"
    yaml_file = tmp_path / "notebooks.yaml"
    yaml_file.write_text(yaml_content)
    db = MagicMock()
    svc = StudyPathService(db_client=db, notebooks_yaml_path=str(yaml_file))
    assert svc.get_notebooklm_id("vaccini") == "abc-123"


def test_get_notebooklm_id_not_found(tmp_path):
    yaml_content = "vaccini:\n  id: abc-123\n  nome: Vaccini\n  argomento: vaccini\n"
    yaml_file = tmp_path / "notebooks.yaml"
    yaml_file.write_text(yaml_content)
    db = MagicMock()
    svc = StudyPathService(db_client=db, notebooks_yaml_path=str(yaml_file))
    assert svc.get_notebooklm_id("missing") is None
```

- [ ] **Step 2: Run to verify fail**

```bash
python -m pytest tests/test_study_path_service.py -v
```

Expected: `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Implement `study_path_service.py`**

```python
# admin/app/services/study_path_service.py
from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from app.db.supabase import SupabaseRestClient


class StudyPathService:
    def __init__(self, db_client: SupabaseRestClient, notebooks_yaml_path: str) -> None:
        self.db = db_client
        self._yaml_path = Path(notebooks_yaml_path)
        self._notebooks: dict[str, Any] | None = None

    def _load_yaml(self) -> dict[str, Any]:
        if self._notebooks is None:
            self._notebooks = yaml.safe_load(self._yaml_path.read_text(encoding="utf-8")) or {}
        return self._notebooks

    def get_notebooklm_id(self, key: str) -> str | None:
        data = self._load_yaml()
        entry = data.get(key)
        return entry.get("id") if entry else None

    def list_study_path(self, notebook_id: str) -> list[dict[str, Any]]:
        rows = self.db.select(
            "artifacts",
            select="id,type,title,format,content,created_at",
            filters={
                "notebook_id": f"eq.{notebook_id}",
                "type": "in.(study_guide,flashcards,mind_map)",
            },
            order="created_at.desc",
        )
        return rows or []

    def _create_job(self, notebook_id: str, artifact_type: str) -> str:
        row = self.db.insert(
            "generation_jobs",
            {
                "notebook_id": notebook_id,
                "type": artifact_type,
                "status": "pending",
            },
        )
        return row["id"]

    def _save_artifact(
        self,
        notebook_id: str,
        job_id: str,
        artifact_type: str,
        title: str,
        fmt: str,
        content: dict[str, Any],
    ) -> str:
        row = self.db.insert(
            "artifacts",
            {
                "notebook_id": notebook_id,
                "job_id": job_id,
                "type": artifact_type,
                "title": title,
                "format": fmt,
                "content": content,
            },
        )
        return row["id"]

    async def generate_all(self, notebook_id: str, notebook_key: str) -> dict[str, str]:
        """Generate study_guide, flashcards, mind_map. Returns {type: job_id}."""
        from notebooklm import NotebookLMClient

        nlm_id = self.get_notebooklm_id(notebook_key)
        if not nlm_id:
            raise ValueError(f"No NotebookLM ID for key '{notebook_key}'")

        job_ids: dict[str, str] = {}
        for artifact_type in ("study_guide", "flashcards", "mind_map"):
            job_id = self._create_job(notebook_id, artifact_type)
            job_ids[artifact_type] = job_id
            self.db.update(
                "generation_jobs",
                {"id": f"eq.{job_id}"},
                {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()},
            )

        async with await NotebookLMClient.from_storage() as client:
            with tempfile.TemporaryDirectory() as tmpdir:
                # --- study_guide ---
                try:
                    status = await client.artifacts.generate_study_guide(nlm_id, language="it")
                    await client.artifacts.wait_for_completion(nlm_id, status.task_id)
                    out = Path(tmpdir) / "study_guide.md"
                    await client.artifacts.download_report(nlm_id, str(out))
                    text = out.read_text(encoding="utf-8")
                    artifact_id = self._save_artifact(
                        notebook_id, job_ids["study_guide"], "study_guide",
                        "Guida di studio", "markdown", {"text": text}
                    )
                    self.db.update(
                        "generation_jobs",
                        {"id": f"eq.{job_ids['study_guide']}"},
                        {"status": "done", "artifact_id": artifact_id,
                         "finished_at": datetime.now(timezone.utc).isoformat()},
                    )
                except Exception as exc:
                    self.db.update(
                        "generation_jobs",
                        {"id": f"eq.{job_ids['study_guide']}"},
                        {"status": "error", "error_text": str(exc),
                         "finished_at": datetime.now(timezone.utc).isoformat()},
                    )

                # --- flashcards ---
                try:
                    status = await client.artifacts.generate_flashcards(nlm_id)
                    await client.artifacts.wait_for_completion(nlm_id, status.task_id)
                    out = Path(tmpdir) / "flashcards.json"
                    await client.artifacts.download_flashcards(nlm_id, str(out), output_format="json")
                    raw = json.loads(out.read_text(encoding="utf-8"))
                    artifact_id = self._save_artifact(
                        notebook_id, job_ids["flashcards"], "flashcards",
                        "Flashcard", "json", raw
                    )
                    self.db.update(
                        "generation_jobs",
                        {"id": f"eq.{job_ids['flashcards']}"},
                        {"status": "done", "artifact_id": artifact_id,
                         "finished_at": datetime.now(timezone.utc).isoformat()},
                    )
                except Exception as exc:
                    self.db.update(
                        "generation_jobs",
                        {"id": f"eq.{job_ids['flashcards']}"},
                        {"status": "error", "error_text": str(exc),
                         "finished_at": datetime.now(timezone.utc).isoformat()},
                    )

                # --- mind_map ---
                try:
                    mind_map_data = await client.artifacts.generate_mind_map(nlm_id)
                    artifact_id = self._save_artifact(
                        notebook_id, job_ids["mind_map"], "mind_map",
                        "Mappa mentale", "json", mind_map_data
                    )
                    self.db.update(
                        "generation_jobs",
                        {"id": f"eq.{job_ids['mind_map']}"},
                        {"status": "done", "artifact_id": artifact_id,
                         "finished_at": datetime.now(timezone.utc).isoformat()},
                    )
                except Exception as exc:
                    self.db.update(
                        "generation_jobs",
                        {"id": f"eq.{job_ids['mind_map']}"},
                        {"status": "error", "error_text": str(exc),
                         "finished_at": datetime.now(timezone.utc).isoformat()},
                    )

        return job_ids
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_study_path_service.py -v
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add admin/app/services/study_path_service.py admin/tests/test_study_path_service.py
git commit -m "feat(service): add StudyPathService for NotebookLM study path generation"
```

---

### Task 4: API router `api_study_path.py`

**Files:**
- Create: `admin/app/routers/api_study_path.py`
- Modify: `admin/app/dependencies.py`
- Modify: `admin/app/main.py`

- [ ] **Step 1: Create router**

```python
# admin/app/routers/api_study_path.py
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_study_path_service
from app.services.study_path_service import StudyPathService

router = APIRouter(prefix="/api/study-path", tags=["study-path"])


class GenerateRequest(BaseModel):
    notebook_key: str


class GenerateResponse(BaseModel):
    job_ids: dict[str, str]


@router.post("/{notebook_id}/generate", response_model=GenerateResponse)
def generate_study_path(
    notebook_id: str,
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    svc: StudyPathService = Depends(get_study_path_service),
) -> GenerateResponse:
    import asyncio

    if not svc.get_notebooklm_id(req.notebook_key):
        raise HTTPException(status_code=404, detail=f"No NotebookLM ID for key '{req.notebook_key}'")

    job_ids: dict[str, str] = {}

    def run_generation() -> None:
        nonlocal job_ids
        result = asyncio.run(svc.generate_all(notebook_id, req.notebook_key))
        job_ids.update(result)

    background_tasks.add_task(run_generation)
    return GenerateResponse(job_ids={})


@router.get("/{notebook_id}")
def get_study_path(
    notebook_id: str,
    svc: StudyPathService = Depends(get_study_path_service),
) -> list[dict]:
    return svc.list_study_path(notebook_id)
```

- [ ] **Step 2: Add dependency in `admin/app/dependencies.py`**

Add after the existing imports and `create_notebooks_service`:

```python
from app.services.study_path_service import StudyPathService

@lru_cache
def get_study_path_service() -> StudyPathService:
    settings = get_settings()
    try:
        client = build_supabase_client(settings.supabase_url, settings.supabase_key)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    yaml_path = str(settings.base_dir / "notebooks.yaml")
    return StudyPathService(db_client=client, notebooks_yaml_path=yaml_path)
```

- [ ] **Step 3: Register router in `admin/app/main.py`**

Add import and `app.include_router` call:

```python
from app.routers import api_notebooks, api_pipeline, api_study_path, pages
# ...
app.include_router(api_study_path.router)
```

- [ ] **Step 4: Test endpoints manually**

```bash
cd /Users/gianmichele/Development/Personal/fph-prep/admin
source venv/bin/activate
uvicorn api:app --port 8005 --reload
```

In a second terminal:
```bash
# GET study path (empty initially)
curl http://localhost:8005/api/study-path/12ad9068-c413-4a9b-a976-d5ddfb7db13d

# Expected: [] (empty array)
```

- [ ] **Step 5: Commit**

```bash
git add admin/app/routers/api_study_path.py admin/app/dependencies.py admin/app/main.py
git commit -m "feat(api): add study path generate and list endpoints"
```

---

### Task 5: Frontend — `fetchStudyPath` in `notebookContentsApi.js`

**Files:**
- Modify: `src/lib/notebookContentsApi.js`

The frontend reads artifacts directly from Supabase (same pattern as existing functions).

> **Note:** Run this migration in Supabase SQL editor before testing so the `artifacts` table is accessible:
> ```sql
> alter table public.artifacts enable row level security;
> create policy "artifacts are viewable by authenticated users"
>   on public.artifacts for select
>   using (auth.role() = 'authenticated');
> ```

- [ ] **Step 1: Add `fetchStudyPath` to `src/lib/notebookContentsApi.js`**

Append at the end of the file:

```javascript
// Fetch study path artifacts (study_guide, flashcards, mind_map) for a notebook.
// Returns array of { id, type, title, format, content, created_at }.
export async function fetchStudyPath(notebookId) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, type, title, format, content, created_at')
    .eq('notebook_id', notebookId)
    .in('type', ['study_guide', 'flashcards', 'mind_map'])
    .order('created_at', { ascending: false })
  if (error) throw error
  // Keep only the latest artifact per type
  const seen = new Set()
  return (data || []).filter(a => {
    if (seen.has(a.type)) return false
    seen.add(a.type)
    return true
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notebookContentsApi.js
git commit -m "feat(frontend): add fetchStudyPath to notebookContentsApi"
```

---

### Task 6: Frontend — Study path cards in `StudyTopic.jsx`

**Files:**
- Modify: `src/pages/StudyTopic.jsx`

- [ ] **Step 1: Add study path state and fetch to `StudyTopic.jsx`**

Add import and new state after existing state declarations:

```javascript
import { fetchContentByKey, fetchStudyPath } from '../lib/notebookContentsApi'

// Inside StudyTopic component, after existing state:
const [studyPath, setStudyPath] = useState([])
```

Add a second `useEffect` after the existing one (depends on `data`):

```javascript
useEffect(() => {
  if (!data?.id) return
  fetchStudyPath(data.id)
    .then(setStudyPath)
    .catch(err => console.error('study path fetch error', err))
}, [data?.id])
```

- [ ] **Step 2: Add `StudyPathSection` component at the top of the file (before `export default`)**

```javascript
function FlipCard({ card }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button
      onClick={() => setFlipped(f => !f)}
      className="w-full text-left p-4 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors min-h-[80px]"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
        {flipped ? 'Risposta' : 'Domanda'}
      </div>
      <div className="text-on-surface text-sm">
        {flipped ? (card.answer || card.a) : (card.question || card.q)}
      </div>
    </button>
  )
}

function MindMapNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2)
  const children = node.children || node.nodes || []
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <button
        onClick={() => children.length && setOpen(o => !o)}
        className={`flex items-center gap-1 py-0.5 text-sm ${children.length ? 'font-medium text-on-surface cursor-pointer' : 'text-on-surface-variant cursor-default'}`}
      >
        {children.length > 0 && (
          <span className="material-symbols-outlined text-[14px] text-primary">
            {open ? 'expand_more' : 'chevron_right'}
          </span>
        )}
        {node.label || node.title || node.text || node.name}
      </button>
      {open && children.map((child, i) => (
        <MindMapNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function StudyPathSection({ artifacts, notebookKey }) {
  const { t } = useTranslation()
  const [openType, setOpenType] = useState(null)

  const CARDS = [
    {
      type: 'study_guide',
      icon: 'menu_book',
      label: t('study.studyGuide', 'Guida di studio'),
    },
    {
      type: 'flashcards',
      icon: 'style',
      label: t('study.flashcards', 'Flashcard'),
    },
    {
      type: 'mind_map',
      icon: 'account_tree',
      label: t('study.mindMap', 'Mappa mentale'),
    },
    {
      type: 'quiz',
      icon: 'quiz',
      label: t('study.quiz', 'Quiz'),
      link: `/quiz?notebook=${notebookKey}`,
    },
  ]

  const artifactByType = Object.fromEntries(artifacts.map(a => [a.type, a]))

  return (
    <section className="mt-10">
      <h2 className="font-headline font-bold text-xl text-on-surface mb-4">
        {t('study.studyPath', 'Percorso di studi')}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(card => {
          const artifact = artifactByType[card.type]
          const available = !!artifact || card.type === 'quiz'
          const isOpen = openType === card.type

          if (card.link) {
            return (
              <Link
                key={card.type}
                to={card.link}
                className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-primary">{card.icon}</span>
                <span className="text-sm font-medium text-on-surface">{card.label}</span>
              </Link>
            )
          }

          return (
            <div key={card.type}>
              <button
                disabled={!available}
                onClick={() => available && setOpenType(isOpen ? null : card.type)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors text-left ${
                  available
                    ? 'bg-surface-container-lowest hover:bg-surface-container-low cursor-pointer'
                    : 'bg-surface-container opacity-40 cursor-default'
                }`}
              >
                <span className={`material-symbols-outlined ${available ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {card.icon}
                </span>
                <span className="text-sm font-medium text-on-surface flex-1">{card.label}</span>
                {available && (
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                )}
                {!available && (
                  <span className="text-[10px] text-on-surface-variant">In arrivo</span>
                )}
              </button>

              {isOpen && artifact && card.type === 'study_guide' && (
                <div className="mt-2 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant">
                  <MarkdownView content={artifact.content.text} />
                </div>
              )}

              {isOpen && artifact && card.type === 'flashcards' && (
                <div className="mt-2 space-y-2">
                  {(artifact.content.cards || artifact.content.flashcards || []).map((card, i) => (
                    <FlipCard key={i} card={card} />
                  ))}
                </div>
              )}

              {isOpen && artifact && card.type === 'mind_map' && (
                <div className="mt-2 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm">
                  {(artifact.content.nodes || artifact.content.children || []).map((node, i) => (
                    <MindMapNode key={i} node={node} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Add `StudyPathSection` to the return JSX in `StudyTopic.jsx`**

After the `<article>` tag in the return:

```jsx
<article>
  <MarkdownView content={data.content.content_md} />
</article>

{studyPath.length > 0 && (
  <StudyPathSection artifacts={studyPath} notebookKey={key} />
)}
```

- [ ] **Step 4: Add missing i18n keys**

In `src/locales/it.json` (or equivalent) add under the `study` namespace:

```json
"studyPath": "Percorso di studi",
"studyGuide": "Guida di studio",
"flashcards": "Flashcard",
"mindMap": "Mappa mentale",
"quiz": "Quiz"
```

(Check existing locale file structure first and follow the same pattern.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/StudyTopic.jsx src/lib/notebookContentsApi.js src/locales/
git commit -m "feat(frontend): add study path section to StudyTopic with guide, flashcards, mind map"
```

---

## How to Use

### Generate a study path (admin)

With the server running (`./start.sh`):

```bash
# 1. Find notebook_id and key from notebooks.yaml or Supabase
# Example: diabete
NOTEBOOK_ID="12ad9068-c413-4a9b-a976-d5ddfb7db13d"
NOTEBOOK_KEY="diabete"

# 2. POST to trigger generation (runs in background ~2-5 min)
curl -X POST http://localhost:8005/api/study-path/$NOTEBOOK_ID/generate \
  -H "Content-Type: application/json" \
  -d "{\"notebook_key\": \"$NOTEBOOK_KEY\"}"

# 3. Check generation_jobs in Supabase dashboard to monitor status

# 4. Once done, verify artifacts saved:
curl http://localhost:8005/api/study-path/$NOTEBOOK_ID
```

### View in frontend

Navigate to `/study/area/{area_id}` → click a topic → study path cards appear below the main content.
