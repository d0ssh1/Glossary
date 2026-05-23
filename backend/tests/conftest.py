"""Pytest fixtures: per-test temp SQLite + TestClient."""
from __future__ import annotations

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

# Point the DB at a temp file BEFORE importing app modules.
_TMP_DB_FD, _TMP_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="lw_test_")
os.close(_TMP_DB_FD)
os.environ["LW_DATABASE_URL"] = f"sqlite:///{_TMP_DB_PATH}"

from app import database as db_module  # noqa: E402
from app import seed as seed_module  # noqa: E402
from app.database import Base, CREATE_FTS_SQL, get_db  # noqa: E402

# Disable auto-seed during the TestClient startup event — tests build their
# own fixtures and any seeded course would collide with imports (unique
# `stepik_id`) and pollute test isolation.
seed_module.run = lambda *_args, **_kwargs: None  # type: ignore[assignment]

from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _engine() -> Generator[None, None, None]:
    """Bind a fresh SQLite engine pointed at the temp DB for the whole session."""
    engine = create_engine(
        os.environ["LW_DATABASE_URL"],
        connect_args={"check_same_thread": False},
        future=True,
    )

    @event.listens_for(engine, "connect")
    def _enable_fks(dbapi_connection, _record) -> None:
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys = ON")
        cur.close()

    # Patch the module-level engine and session factory.
    db_module.engine = engine
    db_module.SessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text(CREATE_FTS_SQL))

    yield

    engine.dispose()
    try:
        Path(_TMP_DB_PATH).unlink(missing_ok=True)
    except OSError:
        pass


@pytest.fixture(autouse=True)
def _clean_tables() -> Generator[None, None, None]:
    """Wipe tables between tests so each starts from a known state."""
    from app import seed

    db = db_module.SessionLocal()
    try:
        seed.wipe(db)
        db.execute(text("DELETE FROM course_search_fts"))
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    """Yield a TestClient bound to the patched session factory."""

    def _override_get_db():
        db = db_module.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
