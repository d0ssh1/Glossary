"""Term ↔ Step binding endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Step, Term, TermStepBinding
from app.schemas import BindingCreate, BindingRead, BindingUpdate

router = APIRouter(prefix="/bindings", tags=["bindings"])


@router.post("/", response_model=BindingRead, status_code=status.HTTP_201_CREATED)
def create_binding(payload: BindingCreate, db: Session = Depends(get_db)) -> TermStepBinding:
    """Create a new binding. Returns 409 if the (term, step) pair already exists."""
    if db.get(Term, payload.term_id) is None:
        raise HTTPException(status_code=404, detail="Term not found")
    if db.get(Step, payload.step_id) is None:
        raise HTTPException(status_code=404, detail="Step not found")

    existing = db.execute(
        select(TermStepBinding).where(
            TermStepBinding.term_id == payload.term_id,
            TermStepBinding.step_id == payload.step_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Binding already exists")

    binding = TermStepBinding(
        term_id=payload.term_id,
        step_id=payload.step_id,
        is_primary=payload.is_primary,
        is_created_by_user=payload.is_created_by_user,
    )
    db.add(binding)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Binding already exists")
    db.refresh(binding)
    return binding


@router.delete("/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_binding(binding_id: int, db: Session = Depends(get_db)) -> None:
    """Remove a binding."""
    binding = db.get(TermStepBinding, binding_id)
    if binding is None:
        raise HTTPException(status_code=404, detail="Binding not found")
    db.delete(binding)
    db.commit()


@router.patch("/{binding_id}", response_model=BindingRead)
def update_binding(
    binding_id: int, payload: BindingUpdate, db: Session = Depends(get_db)
) -> TermStepBinding:
    """Patch the `is_primary` / `is_created_by_user` flags."""
    binding = db.get(TermStepBinding, binding_id)
    if binding is None:
        raise HTTPException(status_code=404, detail="Binding not found")
    if payload.is_primary is not None:
        binding.is_primary = payload.is_primary
    if payload.is_created_by_user is not None:
        binding.is_created_by_user = payload.is_created_by_user
    db.commit()
    db.refresh(binding)
    return binding
