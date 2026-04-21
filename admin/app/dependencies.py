from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException

from app.config import Settings, get_settings as load_settings
from app.db.supabase import SupabaseConfigError, build_supabase_client
from app.services.notebooks_service import NotebooksService
from app.services.study_path_service import StudyPathService


@lru_cache
def get_settings() -> Settings:
    return load_settings()


@lru_cache
def get_notebooks_service() -> NotebooksService:
    try:
        return create_notebooks_service()
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def create_notebooks_service() -> NotebooksService:
    settings = get_settings()
    client = build_supabase_client(settings.supabase_url, settings.supabase_key)
    return NotebooksService(client)


@lru_cache
def get_study_path_service() -> StudyPathService:
    settings = get_settings()
    try:
        client = build_supabase_client(settings.supabase_url, settings.supabase_key)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    yaml_path = str(settings.base_dir / "notebooks.yaml")
    return StudyPathService(db_client=client, notebooks_yaml_path=yaml_path)
