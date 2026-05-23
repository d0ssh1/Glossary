"""SQLAlchemy engine, session factory, FTS5 bootstrap."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Common declarative base for all ORM models."""


# SQLite needs `check_same_thread=False` so that the session can be reused
# across the FastAPI worker threads. We also enable foreign keys explicitly.
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    future=True,
)


@event.listens_for(engine, "connect")
def _enable_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    """Turn on FK enforcement on every new SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a scoped session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# FTS5 virtual table — created on init_db.
CREATE_FTS_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS course_search_fts USING fts5(
    content_text,
    step_id UNINDEXED,
    tokenize = "unicode61 remove_diacritics 2"
)
"""


def init_db() -> None:
    """Create all tables and the FTS5 virtual table. Idempotent."""
    # Importing here avoids a circular dependency at module load time.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text(CREATE_FTS_SQL))
        # Defensive migration: add columns added after the initial release
        # to pre-existing SQLite files. Each ALTER is wrapped so this is
        # idempotent — if the column already exists, SQLite raises and we
        # skip it.
        if settings.database_url.startswith("sqlite"):
            existing = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(course)").fetchall()
            }
            migrations = [
                ("import_status", "ALTER TABLE course ADD COLUMN import_status VARCHAR(20) DEFAULT 'idle'"),
                ("import_error", "ALTER TABLE course ADD COLUMN import_error TEXT"),
                ("import_steps_total", "ALTER TABLE course ADD COLUMN import_steps_total INTEGER DEFAULT 0"),
                ("import_steps_done", "ALTER TABLE course ADD COLUMN import_steps_done INTEGER DEFAULT 0"),
            ]
            for col, ddl in migrations:
                if col in existing:
                    continue
                try:
                    conn.exec_driver_sql(ddl)
                except Exception:  # pragma: no cover - defensive
                    pass
