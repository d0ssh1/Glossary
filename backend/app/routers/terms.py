"""Term endpoints scoped under a glossary."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Glossary, Term
from app.schemas import (
    OccurrenceRead,
    TermBulkCreate,
    TermCreate,
    TermRead,
    TermUpdate,
)
from app.services.occurrences import collect_occurrences

router = APIRouter(prefix="/glossaries/{glossary_id}/terms", tags=["terms"])


def _get_glossary_or_404(db: Session, glossary_id: int) -> Glossary:
    glossary = db.get(Glossary, glossary_id)
    if glossary is None:
        raise HTTPException(status_code=404, detail="Glossary not found")
    return glossary


@router.get("/", response_model=list[TermRead])
def list_terms(glossary_id: int, db: Session = Depends(get_db)) -> list[Term]:
    """Return all terms in the glossary."""
    _get_glossary_or_404(db, glossary_id)
    return list(
        db.execute(
            select(Term).where(Term.glossary_id == glossary_id).order_by(Term.id)
        ).scalars()
    )


@router.post("/", response_model=TermRead, status_code=status.HTTP_201_CREATED)
def create_term(
    glossary_id: int, payload: TermCreate, db: Session = Depends(get_db)
) -> Term:
    """Create a single term."""
    _get_glossary_or_404(db, glossary_id)
    term = Term(glossary_id=glossary_id, name=payload.name, definition=payload.definition)
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.post("/bulk", response_model=list[TermRead], status_code=status.HTTP_201_CREATED)
def bulk_create_terms(
    glossary_id: int, payload: TermBulkCreate, db: Session = Depends(get_db)
) -> list[Term]:
    """Create many terms at once.

    Empty names and duplicates are skipped. Duplicate detection is
    case-insensitive — "HTML" and "html" are the same term — so the glossary
    never ends up with two entries that differ only by letter case.
    """
    _get_glossary_or_404(db, glossary_id)

    existing_names = {
        row[0].casefold()
        for row in db.execute(
            select(Term.name).where(Term.glossary_id == glossary_id)
        ).all()
    }

    created: list[Term] = []
    seen: set[str] = set()
    for raw in payload.names:
        name = raw.strip()
        key = name.casefold()
        if not name or key in seen or key in existing_names:
            continue
        seen.add(key)
        term = Term(glossary_id=glossary_id, name=name, definition="")
        db.add(term)
        created.append(term)
    db.commit()
    for t in created:
        db.refresh(t)
    return created


@router.patch("/{term_id}", response_model=TermRead)
def update_term(
    glossary_id: int,
    term_id: int,
    payload: TermUpdate,
    db: Session = Depends(get_db),
) -> Term:
    """Patch term name and/or definition."""
    term = db.get(Term, term_id)
    if term is None or term.glossary_id != glossary_id:
        raise HTTPException(status_code=404, detail="Term not found")
    if payload.name is not None:
        term.name = payload.name
    if payload.definition is not None:
        term.definition = payload.definition
    db.commit()
    db.refresh(term)
    return term


@router.delete("/{term_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_term(
    glossary_id: int, term_id: int, db: Session = Depends(get_db)
) -> None:
    """Remove a term and its bindings."""
    term = db.get(Term, term_id)
    if term is None or term.glossary_id != glossary_id:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(term)
    db.commit()


@router.get("/{term_id}/occurrences", response_model=list[OccurrenceRead])
def list_occurrences(
    glossary_id: int, term_id: int, db: Session = Depends(get_db)
) -> list[OccurrenceRead]:
    """Return one OccurrenceRead per binding of the term."""
    term = db.get(Term, term_id)
    if term is None or term.glossary_id != glossary_id:
        raise HTTPException(status_code=404, detail="Term not found")

    return [OccurrenceRead(**occ) for occ in collect_occurrences(db, term)]
