"""Term occurrence collection.

Shared by the ``/occurrences`` endpoint (lazy, on demand) and the SCORM export
(baked into the payload so the offline player can show contexts without a
backend). One occurrence per binding: the full sentence the term appears in,
with the term bolded — falling back to the FTS snippet when no clean sentence
can be extracted.
"""
from __future__ import annotations

from typing import TypedDict

from sqlalchemy.orm import Session

from app.models import Lesson, Section, Step, Term
from app.services.fts import search_steps_for_term
from app.services.parser import first_sentence_with_term, highlight_term_html


class OccurrenceDict(TypedDict):
    step_id: int
    step_name: str
    step_url: str
    lesson_id: int
    lesson_name: str
    section_id: int
    section_name: str
    snippet: str


def collect_occurrences(db: Session, term: Term) -> list[OccurrenceDict]:
    """Return one occurrence dict per binding of ``term`` (display order)."""
    course_id = term.glossary.course_id

    # Snippet fallback map: FTS hit → highlighted excerpt.
    snippet_map: dict[int, str] = {}
    for step_id, snip in search_steps_for_term(db, course_id, term.name):
        snippet_map[step_id] = snip

    occurrences: list[OccurrenceDict] = []
    for binding in term.bindings:
        step = db.get(Step, binding.step_id)
        if step is None:
            continue
        lesson = db.get(Lesson, step.lesson_id)
        if lesson is None:
            continue
        section = db.get(Section, lesson.section_id)
        if section is None:
            continue
        sentence = first_sentence_with_term(step.content_text, term.name)
        snippet = (
            highlight_term_html(sentence, term.name)
            if sentence
            else snippet_map.get(step.id, "")
        )
        occurrences.append(
            OccurrenceDict(
                step_id=step.id,
                step_name=f"Шаг {step.position}",
                step_url=step.step_url,
                lesson_id=lesson.id,
                lesson_name=lesson.title,
                section_id=section.id,
                section_name=section.title,
                snippet=snippet,
            )
        )
    return occurrences
