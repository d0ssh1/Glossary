"""Course endpoints: CRUD, JSON import, section/lesson index flags."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app import database as _db_module
from app.database import get_db
from app.models import Course, Lesson, Section
from app.schemas import (
    CourseCreate,
    CourseFullRead,
    CourseRead,
    CourseUpdate,
    ImportAccepted,
    ImportRequest,
    ImportStatus,
    LessonRead,
    SectionRead,
    StepRead,
)
from app.services.importer import import_course_from_dump
from app.services.stepik import (
    StepikApiError,
    StepikNotConfigured,
    import_course_from_stepik,
)

router = APIRouter(prefix="/courses", tags=["courses"])


class IndexFlag(BaseModel):
    """PATCH body for toggling `is_indexed` on a section or lesson."""

    is_indexed: bool


def _serialize_course(course: Course) -> CourseFullRead:
    """Build a CourseFullRead with `name` populated on each step."""
    sections: list[SectionRead] = []
    for sec in course.sections:
        lessons: list[LessonRead] = []
        for lesson in sec.lessons:
            steps = [
                StepRead(
                    id=st.id,
                    lesson_id=st.lesson_id,
                    position=st.position,
                    step_url=st.step_url,
                    name=f"Шаг {st.position}",
                )
                for st in lesson.steps
            ]
            lessons.append(
                LessonRead(
                    id=lesson.id,
                    section_id=lesson.section_id,
                    title=lesson.title,
                    position=lesson.position,
                    is_indexed=lesson.is_indexed,
                    steps=steps,
                )
            )
        sections.append(
            SectionRead(
                id=sec.id,
                course_id=sec.course_id,
                title=sec.title,
                position=sec.position,
                is_indexed=sec.is_indexed,
                lessons=lessons,
            )
        )
    return CourseFullRead(
        id=course.id,
        title=course.title,
        url=course.url,
        is_parsed=course.is_parsed,
        import_date=course.import_date,
        sections=sections,
    )


@router.get("/", response_model=list[CourseRead])
def list_courses(db: Session = Depends(get_db)) -> list[Course]:
    """Return all courses."""
    return list(db.execute(select(Course).order_by(Course.id)).scalars())


@router.post("/", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)) -> Course:
    """Create a blank course (no sections yet)."""
    course = Course(title=payload.title, url=payload.url)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseFullRead)
def get_course(course_id: int, db: Session = Depends(get_db)) -> CourseFullRead:
    """Return a course with its sections/lessons/steps."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return _serialize_course(course)


@router.patch("/{course_id}", response_model=CourseRead)
def update_course(
    course_id: int, payload: CourseUpdate, db: Session = Depends(get_db)
) -> Course:
    """Rename a course / change its URL. Used by the dashboard's edit button."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    if payload.title is not None:
        course.title = payload.title
    if payload.url is not None:
        course.url = payload.url
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a course and cascade-remove its tree."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()


def _set_status(course_id: int, status_value: str, error: str | None = None) -> None:
    """Update import_status / import_error on a course in a fresh session."""
    db = _db_module.SessionLocal()
    try:
        course = db.get(Course, course_id)
        if course is None:
            return
        course.import_status = status_value
        course.import_error = error
        db.commit()
    finally:
        db.close()


def _bg_import_stepik(
    course_id: int,
    stepik_course_id: int,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> None:
    _set_status(course_id, "running")
    db = _db_module.SessionLocal()
    try:
        # Defer import to avoid a circular dep at module load time.
        from app.services.stepik import with_creds  # noqa: PLC0415

        with with_creds(client_id, client_secret):
            import_course_from_stepik(db, course_id, stepik_course_id)
        _set_status(course_id, "done")
    except Exception as exc:  # noqa: BLE001 - we want to capture any failure
        _set_status(course_id, "error", str(exc))
    finally:
        db.close()


def _bg_import_dump(course_id: int, file_path: Path) -> None:
    _set_status(course_id, "running")
    db = _db_module.SessionLocal()
    try:
        import_course_from_dump(db, course_id, file_path)
        _set_status(course_id, "done")
    except Exception as exc:  # noqa: BLE001
        _set_status(course_id, "error", str(exc))
    finally:
        db.close()


@router.post(
    "/{course_id}/import",
    response_model=ImportAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def import_course(
    course_id: int,
    payload: ImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ImportAccepted:
    """Schedule a course import in the background. Returns 202 immediately."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    if payload.source == "stepik":
        if payload.stepik_course_id is None:
            raise HTTPException(
                status_code=422, detail="stepik_course_id is required for source='stepik'"
            )
        # Surface configuration errors synchronously so the client gets 503 instead of "error" later.
        # Validate against the per-request overrides so the UI's "Client ID" /
        # "Client Secret" fields are checked here rather than .env only.
        from app.services.stepik import _require_creds, with_creds  # type: ignore[attr-defined]  # noqa: PLC0415
        try:
            with with_creds(payload.client_id, payload.client_secret):
                _require_creds()
        except StepikNotConfigured as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except StepikApiError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        course.import_status = "running"
        course.import_error = None
        course.import_steps_total = 0
        course.import_steps_done = 0
        db.commit()
        background_tasks.add_task(
            _bg_import_stepik,
            course_id,
            payload.stepik_course_id,
            payload.client_id,
            payload.client_secret,
        )
        return ImportAccepted(
            course_id=course_id, status="running", message="Stepik import scheduled"
        )

    filename = payload.filename or "sample_course.json"
    file_path: Path = settings.mock_data_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Dump file not found: {filename}")
    course.import_status = "running"
    course.import_error = None
    db.commit()
    background_tasks.add_task(_bg_import_dump, course_id, file_path)
    return ImportAccepted(
        course_id=course_id, status="running", message=f"Import from {filename} scheduled"
    )


@router.get("/{course_id}/import-status", response_model=ImportStatus)
def get_import_status(course_id: int, db: Session = Depends(get_db)) -> ImportStatus:
    """Poll the import progress of a course."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    sections_n = len(course.sections)
    lessons_n = sum(len(s.lessons) for s in course.sections)
    steps_n = sum(len(l.steps) for s in course.sections for l in s.lessons)
    return ImportStatus(
        status=course.import_status,
        error=course.import_error,
        sections_count=sections_n,
        lessons_count=lessons_n,
        steps_count=steps_n,
        steps_total=course.import_steps_total or 0,
        steps_done=course.import_steps_done or 0,
    )


@router.patch("/{course_id}/sections/{section_id}", response_model=SectionRead)
def update_section(
    course_id: int,
    section_id: int,
    payload: IndexFlag,
    db: Session = Depends(get_db),
) -> Section:
    """Toggle `is_indexed` on a section."""
    section = db.get(Section, section_id)
    if section is None or section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Section not found")
    section.is_indexed = payload.is_indexed
    db.commit()
    db.refresh(section)
    return section


@router.patch("/{course_id}/lessons/{lesson_id}", response_model=LessonRead)
def update_lesson(
    course_id: int,
    lesson_id: int,
    payload: IndexFlag,
    db: Session = Depends(get_db),
) -> Lesson:
    """Toggle `is_indexed` on a lesson."""
    lesson = db.get(Lesson, lesson_id)
    if lesson is None or lesson.section.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.is_indexed = payload.is_indexed
    db.commit()
    db.refresh(lesson)
    return lesson
