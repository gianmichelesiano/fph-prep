from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_study_path_service
from app.services.study_path_service import StudyPathService

router = APIRouter(prefix="/api/study-path", tags=["study-path"])


class GenerateRequest(BaseModel):
    notebook_key: str


@router.post("/{notebook_id}/generate")
def generate_study_path(
    notebook_id: str,
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    svc: StudyPathService = Depends(get_study_path_service),
) -> dict:
    if not svc.get_notebooklm_id(req.notebook_key):
        raise HTTPException(status_code=404, detail=f"No NotebookLM ID for key '{req.notebook_key}'")

    def run() -> None:
        asyncio.run(svc.generate_all(notebook_id, req.notebook_key))

    background_tasks.add_task(run)
    return {"status": "started", "notebook_id": notebook_id, "notebook_key": req.notebook_key}


@router.get("/{notebook_id}/jobs")
def get_jobs(
    notebook_id: str,
    svc: StudyPathService = Depends(get_study_path_service),
) -> list[dict]:
    return svc.list_jobs(notebook_id)


@router.get("/{notebook_id}")
def get_study_path(
    notebook_id: str,
    svc: StudyPathService = Depends(get_study_path_service),
) -> list[dict]:
    return svc.list_study_path(notebook_id)
