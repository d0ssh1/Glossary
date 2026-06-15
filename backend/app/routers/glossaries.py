"""Glossary endpoints: CRUD + bulk binding collection from FTS."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Course, Glossary, Term, TermStepBinding
from app.schemas import (
    CollectReport,
    CollectRequest,
    GlossaryCreate,
    GlossaryFullRead,
    GlossaryRead,
    GlossaryUpdate,
)
from app.services.fts import first_sentence_for_term, search_steps_for_term

router = APIRouter(prefix="/glossaries", tags=["glossaries"])


@router.get("/", response_model=list[GlossaryRead])
def list_glossaries(course_id: int, db: Session = Depends(get_db)) -> list[Glossary]:
    """List glossaries belonging to a course."""
    return list(
        db.execute(
            select(Glossary).where(Glossary.course_id == course_id).order_by(Glossary.id)
        ).scalars()
    )


@router.post("/", response_model=GlossaryRead, status_code=status.HTTP_201_CREATED)
def create_glossary(
    course_id: int, payload: GlossaryCreate, db: Session = Depends(get_db)
) -> Glossary:
    """Create a glossary attached to ``course_id``."""
    if db.get(Course, course_id) is None:
        raise HTTPException(status_code=404, detail="Course not found")
    glossary = Glossary(
        course_id=course_id,
        title=payload.title,
        text_content=payload.text_content,
    )
    db.add(glossary)
    db.commit()
    db.refresh(glossary)
    return glossary


@router.get("/{glossary_id}", response_model=GlossaryFullRead)
def get_glossary(glossary_id: int, db: Session = Depends(get_db)) -> Glossary:
    """Return a glossary with its terms and bindings."""
    glossary = db.get(Glossary, glossary_id)
    if glossary is None:
        raise HTTPException(status_code=404, detail="Glossary not found")
    return glossary


@router.patch("/{glossary_id}", response_model=GlossaryRead)
def update_glossary(
    glossary_id: int, payload: GlossaryUpdate, db: Session = Depends(get_db)
) -> Glossary:
    """Update glossary title / text content."""
    glossary = db.get(Glossary, glossary_id)
    if glossary is None:
        raise HTTPException(status_code=404, detail="Glossary not found")
    if payload.title is not None:
        glossary.title = payload.title
    if payload.text_content is not None:
        glossary.text_content = payload.text_content
    db.commit()
    db.refresh(glossary)
    return glossary


@router.delete("/{glossary_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_glossary(glossary_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a glossary and its terms/bindings."""
    glossary = db.get(Glossary, glossary_id)
    if glossary is None:
        raise HTTPException(status_code=404, detail="Glossary not found")
    db.delete(glossary)
    db.commit()


@router.post("/{glossary_id}/collect", response_model=CollectReport)
def collect_bindings(
    glossary_id: int, payload: CollectRequest, db: Session = Depends(get_db)
) -> CollectReport:
    """For each term, FTS-search the course and create new bindings.

    Bindings created here have ``is_created_by_user=False``. The very first
    binding for a term (i.e. the term has zero existing bindings) is marked
    ``is_primary=True``.
    """
    glossary = db.get(Glossary, glossary_id)
    if glossary is None:
        raise HTTPException(status_code=404, detail="Glossary not found")
    course_id = glossary.course_id

    if payload.term_ids:
        terms = list(
            db.execute(
                select(Term).where(
                    Term.glossary_id == glossary_id, Term.id.in_(payload.term_ids)
                )
            ).scalars()
        )
    else:
        terms = list(
            db.execute(select(Term).where(Term.glossary_id == glossary_id)).scalars()
        )

    created = 0
    for term in terms:
        existing_count = db.execute(
            select(TermStepBinding).where(TermStepBinding.term_id == term.id)
        ).all()
        existing_step_ids = {
            row[0].step_id for row in existing_count
        }
        has_any = len(existing_step_ids) > 0

        hits = search_steps_for_term(db, course_id, term.name)
        for step_id, _snip in hits:
            if step_id in existing_step_ids:
                continue
            is_primary = not has_any  # first ever binding for this term
            db.add(
                TermStepBinding(
                    term_id=term.id,
                    step_id=step_id,
                    is_primary=is_primary,
                    is_created_by_user=False,
                )
            )
            existing_step_ids.add(step_id)
            has_any = True
            created += 1

        # Auto-fill an empty definition with the first sentence the term appears
        # in (course reading order). Hand-written definitions are left untouched.
        if not (term.definition or "").strip():
            sentence = first_sentence_for_term(db, course_id, term.name)
            if sentence:
                term.definition = sentence

    db.commit()
    return CollectReport(terms_processed=len(terms), bindings_created=created)
