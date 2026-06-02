"""CoreApp (coreapp.ai) course import via reverse-engineered player endpoints.

Unlike Stepik, CoreApp has no public OAuth API. Access is gained through the
logged-in user's session cookie (``token``). Each lesson page embeds its content
as a JSON blob in ``window.__PRELOADED_STATE__``; we pull that out and clean the
HTML the same way we do for Stepik steps.

Status: the per-lesson text extraction (``fetch_lesson_text``) is implemented and
testable as soon as a cookie token + a lesson id are supplied. The course-level
structure discovery (``fetch_course_tree``) still needs the endpoint that lists a
course's lessons — see the NotImplementedError message. Wire that in and
``import_course_from_coreapp`` becomes a drop-in alongside the Stepik importer.
"""
from __future__ import annotations

import json
import re

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Course, Lesson, Section, Step
from app.services.fts import reindex_all_for_course
from app.services.parser import clean_html

# Pretend to be a browser so CoreApp serves the full SSR HTML with the state blob.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}

# window.__PRELOADED_STATE__ = {...};</script>
_STATE_RE = re.compile(r"window\.__PRELOADED_STATE__\s*=\s*({.*?});</script>", re.DOTALL)


class CoreAppNotConfigured(RuntimeError):
    """Raised when no session cookie token is available for CoreApp."""


def _token(override: str | None = None) -> str:
    tok = (override or settings.coreapp_token or "").strip()
    if not tok:
        raise CoreAppNotConfigured(
            "Не задан cookie-токен CoreApp. Передайте его в запросе импорта "
            "или заполните LW_COREAPP_TOKEN в backend/.env."
        )
    return tok


def fetch_lesson_text(lesson_id: str, token: str | None = None) -> str:
    """Fetch a single CoreApp lesson and return its cleaned, concatenated text.

    Pulls the embedded ``__PRELOADED_STATE__`` JSON, walks the player blocks, and
    keeps only ``Text`` blocks (skipping quizzes/video/etc.).
    """
    cookies = {"token": _token(token)}
    url = f"{settings.coreapp_base}/player/lesson/{lesson_id}"
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        resp = client.get(url, cookies=cookies, headers=_HEADERS)
        resp.raise_for_status()
        html = resp.text

    match = _STATE_RE.search(html)
    if not match:
        return ""
    try:
        state = json.loads(match.group(1))
    except json.JSONDecodeError:
        return ""

    blocks = state.get("player", {}).get("blocks", {})
    parts: list[str] = []
    for _block_id, block in blocks.items():
        if block.get("type") == "Text":
            raw = block.get("content", {}).get("text", "")
            cleaned = clean_html(raw)
            if cleaned:
                parts.append(cleaned)
    return " ".join(parts)


def fetch_course_tree(coreapp_course_id: str, token: str | None = None) -> dict:
    """Return a normalized ``{sections:[{lessons:[{steps:[...]}]}]}`` structure.

    NOT YET IMPLEMENTED — needs the CoreApp endpoint that lists a course's
    sections/lessons. Once known, fetch it here (with the same cookie header as
    ``fetch_lesson_text``), then for each lesson call ``fetch_lesson_text`` to
    fill the step text. Mirror the shape produced by ``stepik.fetch_course_tree``
    so ``import_course_from_coreapp`` can stay simple.
    """
    _token(token)  # validate creds early
    raise NotImplementedError(
        "Импорт структуры курса CoreApp ещё не реализован: нужен эндпоинт, "
        "который возвращает список уроков курса. Передайте пример ответа "
        "(URL + JSON), и я допишу обход дерева."
    )


def import_course_from_coreapp(
    db: Session,
    course_id: int,
    coreapp_course_id: str,
    token: str | None = None,
) -> Course:
    """Populate a local Course from a CoreApp course (sections→lessons→steps).

    Relies on ``fetch_course_tree``; until that's wired the call surfaces a clear
    NotImplementedError rather than silently importing nothing.
    """
    tree = fetch_course_tree(coreapp_course_id, token)

    course = db.get(Course, course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found")

    # Wipe any previous structure (same approach as the Stepik importer).
    for section in list(course.sections):
        db.delete(section)
    db.flush()
    course.title = tree.get("title", course.title)

    for s_idx, section in enumerate(tree.get("sections", [])):
        db_section = Section(
            course_id=course.id,
            title=section.get("title", f"Раздел {s_idx + 1}"),
            position=s_idx,
        )
        db.add(db_section)
        db.flush()
        for l_idx, lesson in enumerate(section.get("lessons", [])):
            db_lesson = Lesson(
                section_id=db_section.id,
                title=lesson.get("title", f"Урок {l_idx + 1}"),
                position=l_idx,
            )
            db.add(db_lesson)
            db.flush()
            for st_idx, step in enumerate(lesson.get("steps", [])):
                raw_html = step.get("raw_html", step.get("content", ""))
                db.add(Step(
                    lesson_id=db_lesson.id,
                    position=st_idx,
                    raw_html=raw_html,
                    content_text=clean_html(raw_html),
                ))
    course.is_parsed = True
    db.commit()
    reindex_all_for_course(db, course.id)
    db.refresh(course)
    return course
