from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.dependencies import get_settings
from app.routers import api_notebooks, api_pipeline, api_study_path, pages


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")

    app.include_router(pages.router)
    app.include_router(api_notebooks.router)
    app.include_router(api_pipeline.router)
    app.include_router(api_study_path.router)

    @app.get("/health")
    def health() -> dict[str, bool | str]:
        return {"ok": True, "supabase_configured": settings.supabase_configured}

    return app


app = create_app()
