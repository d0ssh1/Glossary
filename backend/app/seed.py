"""Database seeding helpers for development and tests."""
from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Course,
    Glossary,
    Lesson,
    Section,
    Step,
    Term,
    TermStepBinding,
)
from app.services.fts import search_steps_for_term
from app.services.importer import import_course_from_dump

DEMO_TERMS: list[str] = [
    "SELECT",
    "JOIN",
    "Внешний ключ",
    "WHERE",
    "Таблица",
    "Первичный ключ",
    "Алгоритм",
]


def wipe(db: Session) -> None:
    """Remove every row from every domain table. Test helper."""
    db.execute(delete(TermStepBinding))
    db.execute(delete(Term))
    db.execute(delete(Glossary))
    db.execute(delete(Step))
    db.execute(delete(Lesson))
    db.execute(delete(Section))
    db.execute(delete(Course))
    db.commit()


def run(db: Session) -> Course:
    """Create a demo course + glossary populated from mock dumps."""
    course = Course(title="Интерактивный тренажёр по SQL", url="")
    db.add(course)
    db.commit()
    db.refresh(course)

    sample = settings.mock_data_dir / "sample_course.json"
    if sample.exists():
        import_course_from_dump(db, course.id, sample)

    glossary = Glossary(course_id=course.id, title="Глоссарий 1", text_content="")
    db.add(glossary)
    db.commit()
    db.refresh(glossary)

    for name in DEMO_TERMS:
        db.add(Term(glossary_id=glossary.id, name=name, definition=""))
    db.commit()

    # Auto-collect bindings for the seeded glossary.
    for term in glossary.terms:
        existing_step_ids: set[int] = set()
        has_any = False
        for step_id, _snip in search_steps_for_term(db, course.id, term.name):
            if step_id in existing_step_ids:
                continue
            db.add(
                TermStepBinding(
                    term_id=term.id,
                    step_id=step_id,
                    is_primary=not has_any,
                    is_created_by_user=False,
                )
            )
            existing_step_ids.add(step_id)
            has_any = True
    db.commit()
    db.refresh(course)
    return course
