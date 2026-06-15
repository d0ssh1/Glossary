"""Stepik OAuth 2.0 client + course-tree fetcher.

Implements OAuth 2.0 Client Credentials Flow:
    1. POST /oauth2/token/ with HTTPBasicAuth(client_id, client_secret) and
       grant_type=client_credentials → access_token cached in-memory.
    2. Walk ``courses → sections → units → lessons → steps`` using the bearer
       token. Each ``Step.block.text`` is fed into ``parser.clean_html`` and
       persisted alongside the raw HTML.

Falls back gracefully: if the credentials are blank in settings, all helpers
raise ``StepikNotConfigured`` so the router can return a clear 503.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Course, Lesson, Section, Step
from app.services.fts import reindex_all_for_course
from app.services.parser import clean_html


class StepikNotConfigured(RuntimeError):
    """Raised when OAuth credentials are missing from settings."""


class StepikApiError(RuntimeError):
    """Raised for any non-2xx response from Stepik."""


_TOKEN_CACHE: dict[str, Any] = {"access_token": None, "expires_at": 0.0}

# Per-call override of OAuth creds. When the caller passes client_id/secret in
# the request body, ``with_creds`` installs them here for the duration of one
# import and ``get_access_token`` bypasses the in-memory cache.
_CREDS_OVERRIDE: dict[str, Optional[str]] = {"id": None, "secret": None}


def _require_creds() -> tuple[str, str]:
    cid = (_CREDS_OVERRIDE["id"] or settings.stepik_client_id).strip()
    secret = (_CREDS_OVERRIDE["secret"] or settings.stepik_client_secret).strip()
    if not cid or not secret:
        raise StepikNotConfigured("Stepik client_id/secret are not configured.")
    return cid, secret


def get_access_token(force_refresh: bool = False) -> str:
    """Return a cached bearer token, refreshing it if expired.

    The token cache is *skipped* when an override is active so the per-request
    keys are actually used — otherwise we'd serve a token minted with .env keys.
    """
    override_active = bool(_CREDS_OVERRIDE["id"] or _CREDS_OVERRIDE["secret"])
    now = time.time()
    if (
        not override_active
        and not force_refresh
        and _TOKEN_CACHE["access_token"]
        and _TOKEN_CACHE["expires_at"] > now + 30
    ):
        return _TOKEN_CACHE["access_token"]

    cid, secret = _require_creds()
    with httpx.Client(timeout=20.0) as client:
        resp = client.post(
            settings.stepik_oauth_url,
            data={"grant_type": "client_credentials"},
            auth=(cid, secret),
        )
    if resp.status_code != 200:
        raise StepikApiError(f"Stepik OAuth failed: {resp.status_code} {resp.text}")
    payload = resp.json()
    if override_active:
        # Don't poison the cache used by subsequent .env-based requests.
        return payload["access_token"]
    _TOKEN_CACHE["access_token"] = payload["access_token"]
    _TOKEN_CACHE["expires_at"] = now + int(payload.get("expires_in", 3600))
    return _TOKEN_CACHE["access_token"]


class with_creds:
    """Context manager: temporarily install per-request OAuth credentials.

    Empty/None values fall through to ``settings``. Restored on exit so the
    background-task worker doesn't leak creds across imports.
    """

    def __init__(self, client_id: Optional[str], client_secret: Optional[str]) -> None:
        self._cid = (client_id or "").strip() or None
        self._secret = (client_secret or "").strip() or None
        self._prev: tuple[Optional[str], Optional[str]] = (None, None)

    def __enter__(self) -> "with_creds":
        self._prev = (_CREDS_OVERRIDE["id"], _CREDS_OVERRIDE["secret"])
        if self._cid:
            _CREDS_OVERRIDE["id"] = self._cid
        if self._secret:
            _CREDS_OVERRIDE["secret"] = self._secret
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        _CREDS_OVERRIDE["id"], _CREDS_OVERRIDE["secret"] = self._prev


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {get_access_token()}"}


def _api_get(client: httpx.Client, path: str, **params: Any) -> dict:
    """GET a Stepik endpoint with auth, returning the JSON envelope."""
    url = f"{settings.stepik_api_base}{path}"
    resp = client.get(url, headers=_auth_headers(), params=params)
    if resp.status_code == 401:
        # Token might have rotated server-side — try once more with a fresh one.
        get_access_token(force_refresh=True)
        resp = client.get(url, headers=_auth_headers(), params=params)
    if resp.status_code >= 400:
        raise StepikApiError(f"Stepik {path} → {resp.status_code} {resp.text[:200]}")
    return resp.json()


def _paged_list(client: httpx.Client, path: str, key: str, ids: list[int]) -> list[dict]:
    """Fetch a batched-by-IDs list endpoint, paging through every page Stepik returns."""
    out: list[dict] = []
    # Stepik caps `ids[]` at ~100 per request — chunk defensively.
    for chunk_start in range(0, len(ids), 80):
        chunk = ids[chunk_start : chunk_start + 80]
        page = 1
        while True:
            payload = _api_get(client, path, **{"ids[]": chunk, "page": page})
            out.extend(payload.get(key, []))
            if not payload.get("meta", {}).get("has_next"):
                break
            page += 1
    return out


def fetch_course_tree(stepik_course_id: int) -> dict:
    """Return a normalized course tree in the same JSON shape as ``importer``.

    Output schema:
        {title, stepik_id, sections:[{title, position, stepik_id, lessons:[
            {title, position, stepik_id, steps:[{position, stepik_id, raw_html}]}]}]}
    """
    with httpx.Client(timeout=30.0) as client:
        course_data = _api_get(client, f"/courses/{stepik_course_id}")
        if not course_data.get("courses"):
            raise StepikApiError(f"Course {stepik_course_id} not found on Stepik.")
        course = course_data["courses"][0]

        section_ids = course.get("sections", [])
        sections_raw = _paged_list(client, "/sections", "sections", section_ids) if section_ids else []

        unit_ids = [uid for s in sections_raw for uid in s.get("units", [])]
        units_raw = _paged_list(client, "/units", "units", unit_ids) if unit_ids else []
        unit_by_id = {u["id"]: u for u in units_raw}

        lesson_ids = [u["lesson"] for u in units_raw if u.get("lesson")]
        lessons_raw = _paged_list(client, "/lessons", "lessons", lesson_ids) if lesson_ids else []
        lesson_by_id = {l["id"]: l for l in lessons_raw}

        step_ids = [sid for l in lessons_raw for sid in l.get("steps", [])]
        steps_raw = _paged_list(client, "/steps", "steps", step_ids) if step_ids else []
        step_by_id = {s["id"]: s for s in steps_raw}

    # Assemble the tree in display order.
    sections_out = []
    for sec in sorted(sections_raw, key=lambda s: s.get("position", 0)):
        lessons_out = []
        # Map sec → its units → lessons.
        for uid in sec.get("units", []):
            unit = unit_by_id.get(uid)
            if not unit:
                continue
            lesson = lesson_by_id.get(unit.get("lesson"))
            if not lesson:
                continue
            steps_out = []
            for st_pos, sid in enumerate(lesson.get("steps", []), start=1):
                step = step_by_id.get(sid)
                if not step:
                    continue
                block = step.get("block", {}) or {}
                raw_html = block.get("text", "") or ""
                # Per Защита.md §"Сбор данных": skip non-text blocks (video/code/quiz)
                # that have no textual description — they pollute the FTS index.
                block_name = block.get("name", "text")
                if block_name != "text" and not raw_html.strip():
                    continue
                steps_out.append(
                    {
                        "stepik_id": step["id"],
                        "position": step.get("position", st_pos),
                        "raw_html": raw_html,
                        "block_type": block_name,
                    }
                )
            lessons_out.append(
                {
                    "title": lesson.get("title", "Урок"),
                    "stepik_id": lesson["id"],
                    "unit_id": unit["id"],
                    "position": unit.get("position", 0),
                    "steps": steps_out,
                }
            )
        sections_out.append(
            {
                "title": sec.get("title", "Раздел"),
                "stepik_id": sec["id"],
                "position": sec.get("position", 0),
                "lessons": lessons_out,
            }
        )

    return {
        "title": course.get("title", "Курс без названия"),
        "stepik_id": course["id"],
        "sections": sections_out,
    }


def import_course_from_stepik(db: Session, course_id: int, stepik_course_id: int) -> Course:
    """Pull a course from the live Stepik API and persist it into the given Course row."""
    course = db.get(Course, course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found")

    tree = fetch_course_tree(stepik_course_id)

    # Replace previous structure.
    for section in list(course.sections):
        db.delete(section)
    db.flush()

    # Preserve the user-entered course name; the parsed Stepik title is only a
    # fallback for courses created without a name.
    if not (course.title or "").strip():
        course.title = tree.get("title", course.title)
    new_stepik_id = tree.get("stepik_id")
    # UNIQUE constraint on `course.stepik_id` means only one local course can
    # claim a given Stepik course id at a time. If another row is already
    # holding this id, transfer ownership: null out the previous one so the
    # current import can succeed. This lets the user re-import the same Stepik
    # course into a fresh local "course" entry without manually deleting the
    # previous one.
    if new_stepik_id is not None:
        prior = db.execute(
            select(Course).where(
                Course.stepik_id == new_stepik_id, Course.id != course.id
            )
        ).scalars().all()
        for p in prior:
            p.stepik_id = None
        if prior:
            db.flush()
    course.stepik_id = new_stepik_id

    # Compute up-front total so the frontend can show X of N progress.
    steps_total = sum(
        len(l.get("steps", []))
        for s in tree.get("sections", [])
        for l in s.get("lessons", [])
    )
    course.import_steps_total = steps_total
    course.import_steps_done = 0
    db.commit()  # publish total immediately so polling sees it

    # Spec (Защита.md §"тонкость с step_url"):
    #     https://stepik.org/lesson/{lesson_id}/step/{position}?unit={unit_id}
    step_url_tmpl = "https://stepik.org/lesson/{lesson_id}/step/{position}?unit={unit_id}"

    # Commit batch — large enough to amortise overhead, small enough to feel live.
    COMMIT_EVERY = 25
    done = 0

    for s_data in tree.get("sections", []):
        section = Section(
            course_id=course.id,
            title=s_data["title"],
            stepik_id=s_data.get("stepik_id"),
            position=s_data.get("position", 0),
        )
        db.add(section)
        db.flush()
        for l_data in s_data.get("lessons", []):
            lesson = Lesson(
                section_id=section.id,
                title=l_data["title"],
                stepik_id=l_data.get("stepik_id"),
                position=l_data.get("position", 0),
            )
            db.add(lesson)
            db.flush()
            unit_id = l_data.get("unit_id")
            for st_data in l_data.get("steps", []):
                raw_html = st_data.get("raw_html", "")
                step = Step(
                    lesson_id=lesson.id,
                    stepik_id=st_data.get("stepik_id"),
                    position=st_data.get("position", 0),
                    raw_html=raw_html,
                    content_text=clean_html(raw_html),
                    step_url=step_url_tmpl.format(
                        lesson_id=lesson.stepik_id or lesson.id,
                        position=st_data.get("position", 0),
                        unit_id=unit_id or "",
                    ),
                )
                db.add(step)
                done += 1
                if done % COMMIT_EVERY == 0:
                    course.import_steps_done = done
                    db.commit()

    course.import_steps_done = done
    course.is_parsed = True
    course.import_date = datetime.now(timezone.utc)
    db.flush()
    reindex_all_for_course(db, course.id)
    db.commit()
    db.refresh(course)
    return course
