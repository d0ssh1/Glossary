"""Course import service.

Reads a JSON dump that mimics Stepik's API responses, persists the
``Course → Section → Lesson → Step`` tree, runs HTML cleanup on each step's
``raw_html``, and indexes the cleaned text in the FTS5 virtual table.

Real Stepik OAuth is out of scope for this build (no production credentials);
the JSON-dump pathway is the supported way to populate a course locally.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Course, Lesson, Section, Step
from app.services.fts import reindex_all_for_course
from app.services.parser import clean_html

STEPIK_STEP_URL = "https://stepik.org/lesson/{lesson_id}/step/{position}"


def import_course_from_dump(db: Session, course_id: int, path: Path) -> Course:
    """Load a course tree from a JSON file into the database.

    JSON format (kept minimal — mirrors the fields we actually use from Stepik):

        {
          "title": "...",
          "stepik_id": 12345,
          "sections": [
            { "title": "...", "position": 1, "lessons": [
              { "title": "...", "position": 1, "stepik_id": 9000, "steps": [
                { "position": 1, "raw_html": "<p>...</p>" }
              ]}
            ]}
          ]
        }
    """
    course = db.get(Course, course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found")

    payload = json.loads(path.read_text(encoding="utf-8"))

    # Wipe previous structure — re-import is destructive on purpose.
    for section in list(course.sections):
        db.delete(section)
    db.flush()

    # Keep the name the user typed when creating the course — only fall back to
    # the dump's title if the course was created without one.
    if not (course.title or "").strip():
        course.title = payload.get("title", course.title)
    course.stepik_id = payload.get("stepik_id", course.stepik_id)

    # Publish the total up-front so polling clients see a meaningful denominator
    # even if the persistence loop finishes faster than the next poll tick.
    steps_total = sum(
        len(l.get("steps", []))
        for s in payload.get("sections", [])
        for l in s.get("lessons", [])
    )
    course.import_steps_total = steps_total
    course.import_steps_done = 0
    db.commit()

    sections_n = lessons_n = steps_n = 0
    COMMIT_EVERY = 25

    for s_pos, s_data in enumerate(payload.get("sections", []), start=1):
        section = Section(
            course_id=course.id,
            title=s_data.get("title", f"Раздел {s_pos}"),
            position=s_data.get("position", s_pos),
            stepik_id=s_data.get("stepik_id"),
        )
        db.add(section)
        db.flush()
        sections_n += 1

        for l_pos, l_data in enumerate(s_data.get("lessons", []), start=1):
            lesson = Lesson(
                section_id=section.id,
                title=l_data.get("title", f"Урок {l_pos}"),
                position=l_data.get("position", l_pos),
                stepik_id=l_data.get("stepik_id"),
            )
            db.add(lesson)
            db.flush()
            lessons_n += 1

            for st_pos, st_data in enumerate(l_data.get("steps", []), start=1):
                raw_html = st_data.get("raw_html", "")
                step = Step(
                    lesson_id=lesson.id,
                    stepik_id=st_data.get("stepik_id"),
                    position=st_data.get("position", st_pos),
                    raw_html=raw_html,
                    content_text=clean_html(raw_html),
                    step_url=STEPIK_STEP_URL.format(
                        lesson_id=lesson.stepik_id or lesson.id,
                        position=st_data.get("position", st_pos),
                    ),
                )
                db.add(step)
                steps_n += 1
                if steps_n % COMMIT_EVERY == 0:
                    course.import_steps_done = steps_n
                    db.commit()

    course.import_steps_done = steps_n
    course.is_parsed = True
    course.import_date = datetime.now(timezone.utc)
    db.flush()

    reindex_all_for_course(db, course.id)
    db.commit()
    db.refresh(course)
    return course
