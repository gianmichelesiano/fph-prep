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

    def list_jobs(self, notebook_id: str) -> list[dict[str, Any]]:
        rows = self.db.select(
            "generation_jobs",
            select="id,type,status,error_text,created_at,started_at,finished_at",
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

    async def _generate_study_guide(self, client: Any, nlm_id: str, notebook_id: str, job_id: str) -> None:
        try:
            status = await client.artifacts.generate_study_guide(nlm_id, language="it")
            await client.artifacts.wait_for_completion(nlm_id, status.task_id)
            with tempfile.TemporaryDirectory() as tmpdir:
                out = Path(tmpdir) / "study_guide.md"
                await client.artifacts.download_report(nlm_id, str(out))
                text = out.read_text(encoding="utf-8")
            artifact_id = self._save_artifact(notebook_id, job_id, "study_guide", "Guida di studio", "markdown", {"text": text})
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "done", "artifact_id": artifact_id, "finished_at": datetime.now(timezone.utc).isoformat()})
        except Exception as exc:
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "error", "error_text": str(exc), "finished_at": datetime.now(timezone.utc).isoformat()})

    async def _generate_flashcards(self, client: Any, nlm_id: str, notebook_id: str, job_id: str) -> None:
        try:
            status = await client.artifacts.generate_flashcards(nlm_id)
            await client.artifacts.wait_for_completion(nlm_id, status.task_id)
            with tempfile.TemporaryDirectory() as tmpdir:
                out = Path(tmpdir) / "flashcards.json"
                await client.artifacts.download_flashcards(nlm_id, str(out), output_format="json")
                raw = json.loads(out.read_text(encoding="utf-8"))
            artifact_id = self._save_artifact(notebook_id, job_id, "flashcards", "Flashcard", "json", raw)
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "done", "artifact_id": artifact_id, "finished_at": datetime.now(timezone.utc).isoformat()})
        except Exception as exc:
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "error", "error_text": str(exc), "finished_at": datetime.now(timezone.utc).isoformat()})

    async def _generate_mind_map(self, client: Any, nlm_id: str, notebook_id: str, job_id: str) -> None:
        try:
            mind_map_data = await client.artifacts.generate_mind_map(nlm_id)
            artifact_id = self._save_artifact(notebook_id, job_id, "mind_map", "Mappa mentale", "json", mind_map_data)
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "done", "artifact_id": artifact_id, "finished_at": datetime.now(timezone.utc).isoformat()})
        except Exception as exc:
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "error", "error_text": str(exc), "finished_at": datetime.now(timezone.utc).isoformat()})

    async def generate_one_or_all(self, notebook_id: str, notebook_key: str, types: list[str]) -> dict[str, str]:
        """Generate one or more artifact types. Returns {type: job_id}."""
        from notebooklm import NotebookLMClient

        nlm_id = self.get_notebooklm_id(notebook_key)
        if not nlm_id:
            raise ValueError(f"No NotebookLM ID for key '{notebook_key}'")

        job_ids: dict[str, str] = {}
        for artifact_type in types:
            job_id = self._create_job(notebook_id, artifact_type)
            job_ids[artifact_type] = job_id
            self.db.update("generation_jobs", {"id": f"eq.{job_id}"},
                           {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()})

        _generators = {
            "study_guide": self._generate_study_guide,
            "flashcards": self._generate_flashcards,
            "mind_map": self._generate_mind_map,
        }

        async with await NotebookLMClient.from_storage() as client:
            for artifact_type in types:
                await _generators[artifact_type](client, nlm_id, notebook_id, job_ids[artifact_type])

        return job_ids
