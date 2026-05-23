"""Full-text search endpoint over a course's steps."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Course
from app.schemas import OccurrenceRead
from app.services.fts import build_match_query

router = APIRouter(tags=["search"])


@router.get("/courses/{course_id}/search", response_model=list[OccurrenceRead])
def search_course(
    course_id: int,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[OccurrenceRead]:
    """FTS5 search over all steps in a course."""
    if db.get(Course, course_id) is None:
        raise HTTPException(status_code=404, detail="Course not found")

    match_expr = build_match_query(q)
    rows = db.execute(
        text(
            """
            SELECT
                step.id AS step_id,
                step.position AS step_position,
                step.step_url AS step_url,
                lesson.id AS lesson_id,
                lesson.title AS lesson_title,
                section.id AS section_id,
                section.title AS section_title,
                snippet(course_search_fts, 0, '<b>', '</b>', '...', 10) AS snip
            FROM course_search_fts AS fts
            JOIN step ON step.id = fts.step_id
            JOIN lesson ON lesson.id = step.lesson_id
            JOIN section ON section.id = lesson.section_id
            WHERE section.course_id = :cid
              AND course_search_fts MATCH :q
            LIMIT :lim
            """
        ),
        {"cid": course_id, "q": match_expr, "lim": limit},
    ).all()

    return [
        OccurrenceRead(
            step_id=r.step_id,
            step_name=f"Шаг {r.step_position}",
            step_url=r.step_url,
            lesson_id=r.lesson_id,
            lesson_name=r.lesson_title,
            section_id=r.section_id,
            section_name=r.section_title,
            snippet=r.snip or "",
        )
        for r in rows
    ]
