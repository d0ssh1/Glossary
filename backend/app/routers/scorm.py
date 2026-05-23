"""SCORM ZIP download endpoint."""
from __future__ import annotations

import io
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Glossary
from app.services.scorm import build_scorm_zip

router = APIRouter(tags=["scorm"])


class ScormExportRequest(BaseModel):
    """POST body for SCORM export."""

    scorm_id: str
    version: Literal["1.2", "2004"] = "1.2"


@router.post("/glossaries/{glossary_id}/scorm")
def export_scorm(
    glossary_id: int,
    payload: ScormExportRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Build and stream a SCORM ZIP for the glossary."""
    glossary = db.get(Glossary, glossary_id)
    if glossary is None:
        raise HTTPException(status_code=404, detail="Glossary not found")

    data = build_scorm_zip(db, glossary, payload.scorm_id, payload.version)
    filename = f"{glossary.title}_scorm.zip"
    # RFC 5987 encoding for non-ASCII filename
    encoded = quote(filename)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
        },
    )
