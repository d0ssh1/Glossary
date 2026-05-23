"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app import seed
from app.config import settings
from app.database import SessionLocal, init_db
from app.models import Course
from app.routers import bindings, courses, glossaries, scorm, search, terms


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialise DB and seed mock data on first launch."""
    init_db()
    sample = settings.mock_data_dir / "sample_course.json"
    if sample.exists():
        db = SessionLocal()
        try:
            any_course = db.execute(select(Course).limit(1)).first()
            if any_course is None:
                seed.run(db)
        finally:
            db.close()
    yield


app = FastAPI(title="Lexicon Weaver API", version="1.0.0", lifespan=lifespan)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(courses.router)
app.include_router(glossaries.router)
app.include_router(terms.router)
app.include_router(bindings.router)
app.include_router(scorm.router)
app.include_router(search.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}
