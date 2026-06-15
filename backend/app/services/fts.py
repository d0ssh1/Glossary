"""FTS5 helpers — keep ``course_search_fts`` in sync with ``step.content_text``."""
from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Step
from app.services.parser import first_sentence_with_term


def reindex_step(db: Session, step: Step) -> None:
    """Re-write the FTS row for a single step."""
    db.execute(text("DELETE FROM course_search_fts WHERE step_id = :sid"), {"sid": step.id})
    if step.content_text:
        db.execute(
            text("INSERT INTO course_search_fts (step_id, content_text) VALUES (:sid, :ct)"),
            {"sid": step.id, "ct": step.content_text},
        )


def reindex_all_for_course(db: Session, course_id: int) -> int:
    """Drop and rebuild FTS entries for every step in the given course.

    Returns the number of indexed steps.
    """
    step_ids = [
        row[0]
        for row in db.execute(
            text(
                """
                SELECT step.id FROM step
                JOIN lesson ON lesson.id = step.lesson_id
                JOIN section ON section.id = lesson.section_id
                WHERE section.course_id = :cid
                """
            ),
            {"cid": course_id},
        )
    ]
    if step_ids:
        db.execute(
            text(
                f"DELETE FROM course_search_fts WHERE step_id IN ({','.join(str(s) for s in step_ids)})"
            )
        )
    indexed = 0
    for sid in step_ids:
        step = db.get(Step, sid)
        if step and step.content_text:
            db.execute(
                text("INSERT INTO course_search_fts (step_id, content_text) VALUES (:sid, :ct)"),
                {"sid": step.id, "ct": step.content_text},
            )
            indexed += 1
    return indexed


_FTS_SPECIALS = re.compile(r'[\"():*]')


def build_match_query(term_name: str) -> str:
    """Build a safe FTS5 MATCH expression.

    Splits the term into tokens, strips FTS5 syntax characters, and joins
    them with NEAR to match the whole phrase regardless of inflection.
    """
    cleaned = _FTS_SPECIALS.sub(" ", term_name).strip()
    tokens = [t for t in cleaned.split() if t]
    if not tokens:
        return '""'
    if len(tokens) == 1:
        # Wrap single token in quotes to neutralize special meaning, add prefix wildcard.
        return f'"{tokens[0]}"*'
    quoted = " ".join(f'"{t}"' for t in tokens)
    return f"NEAR({quoted}, 5)"


def search_steps_for_term(db: Session, course_id: int, term_name: str) -> list[tuple[int, str]]:
    """Return [(step_id, snippet)] of FTS hits in the given course for ``term_name``."""
    match_expr = build_match_query(term_name)
    rows = db.execute(
        text(
            """
            SELECT fts.step_id, snippet(course_search_fts, 0, '<b>', '</b>', '...', 10) AS snip
            FROM course_search_fts AS fts
            JOIN step ON step.id = fts.step_id
            JOIN lesson ON lesson.id = step.lesson_id
            JOIN section ON section.id = lesson.section_id
            WHERE section.course_id = :cid
              AND course_search_fts MATCH :q
            """
        ),
        {"cid": course_id, "q": match_expr},
    ).all()
    return [(r[0], r[1]) for r in rows]


def first_sentence_for_term(db: Session, course_id: int, term_name: str) -> str | None:
    """The first sentence (in course reading order) where ``term_name`` appears.

    Used to auto-fill a term's definition on "Собрать данные". Walks the FTS
    hits, orders the steps by section→lesson→step position, and returns the
    first full sentence containing the term.
    """
    hits = search_steps_for_term(db, course_id, term_name)
    if not hits:
        return None
    steps = [s for s in (db.get(Step, sid) for sid, _ in hits) if s is not None]

    def order_key(step: Step) -> tuple[int, int, int]:
        lesson = step.lesson
        section = lesson.section if lesson else None
        return (
            section.position if section else 0,
            lesson.position if lesson else 0,
            step.position,
        )

    for step in sorted(steps, key=order_key):
        sentence = first_sentence_with_term(step.content_text, term_name)
        if sentence:
            return sentence
    return None
