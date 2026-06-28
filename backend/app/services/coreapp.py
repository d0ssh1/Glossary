"""CoreApp (coreapp.ai) course import.

CoreApp has no public OAuth API and renders client-side. Access is gained by
logging in as the user: this module drives a headless browser (Playwright) to
fill the Blueprint "course-auth" modal, captures the HttpOnly ``token`` cookie,
then sniffs the course's own JSON API responses and normalizes the structure —
cleaning lesson HTML the same way the Stepik importer does.

Architecture (mirrors ``services/stepik.py`` so the two import paths look alike):

    CoreappParser.run_parsing()          # orchestration
        ├── _init_browser()              # launch headless chromium
        ├── authenticate()               # course-auth modal → `token` cookie
        ├── fetch_course_data()          # sniff API JSON → course tree
        └── _cleanup()                   # always tear the browser down

``run_parsing`` returns the same normalized ``{title, sections:[{lessons:[{
steps:[{raw_html}]}]}]}`` tree that ``importer``/``stepik`` produce, so
``import_course_from_coreapp`` can persist it with the shared loop below.

Platform-specific bits that may need adjustment if CoreApp changes:
  * Login selectors — class constants on ``CoreappParser`` (anchored to the
    stable ``bp5-tab-panel_payment-with-auth_*`` ids, NOT styled-component hashes).
  * Course-JSON shape — ``_extract_course_tree`` / ``_find_course_node`` search
    for a module→lesson tree heuristically; tighten once the real endpoint shape
    is known. On miss, ``fetch_course_data`` raises with the captured API URLs.
"""
from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Course, Lesson, Section, Step
from app.schemas import CoreappParsingRequest
from app.services.fts import reindex_all_for_course
from app.services.parser import clean_html

# Pretend to be a browser so CoreApp serves the full SSR HTML with the state blob.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
_HEADERS = {"User-Agent": _USER_AGENT}

# window.__PRELOADED_STATE__ = {...};</script>
_STATE_RE = re.compile(r"window\.__PRELOADED_STATE__\s*=\s*({.*?});</script>", re.DOTALL)


class CoreAppNotConfigured(RuntimeError):
    """Raised when no credentials/token are available for CoreApp."""


class CoreAppAuthError(RuntimeError):
    """Raised when login fails (bad credentials, selector/timeout, captcha)."""


class CoreAppParsingError(RuntimeError):
    """Raised when the course structure can't be read or the browser can't start."""


# --------------------------------------------------------------------------- #
# Cookie-token path (used for fast per-lesson text fetches once authenticated)
# --------------------------------------------------------------------------- #
def _token(override: Optional[str] = None) -> str:
    tok = (override or settings.coreapp_token or "").strip()
    if not tok:
        raise CoreAppNotConfigured(
            "Не задан токен CoreApp. Выполните вход (логин/пароль) или заполните "
            "LW_COREAPP_TOKEN в backend/.env."
        )
    return tok


def fetch_lesson_text(lesson_id: str, token: Optional[str] = None) -> str:
    """Fetch a single CoreApp lesson and return its cleaned, concatenated text.

    Pulls the embedded ``__PRELOADED_STATE__`` JSON, walks the player blocks, and
    keeps only ``Text`` blocks (skipping quizzes/video/etc.). Uses a plain HTTP
    request with the session cookie — much faster than driving the browser once
    we already hold a token.
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
    return _blocks_to_text(state.get("player", {}).get("blocks", {}))


def _blocks_to_text(blocks: Any) -> str:
    """Concatenate the cleaned text of all ``Text`` blocks in a lesson player."""
    parts: list[str] = []
    # CoreApp stores blocks either as a dict keyed by id or as a list.
    iterable = blocks.values() if isinstance(blocks, dict) else (blocks or [])
    for block in iterable:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "Text":
            raw = block.get("content", {}).get("text", "")
            cleaned = clean_html(raw)
            if cleaned:
                parts.append(cleaned)
    return " ".join(parts)


# --------------------------------------------------------------------------- #
# State-blob → normalized course tree (pure, unit-testable, no network)
# --------------------------------------------------------------------------- #
# Keys CoreApp might use for the module/lesson groupings — checked in order.
_MODULE_KEYS = ("modules", "sections", "chapters")
_LESSON_KEYS = ("lessons", "items", "children")


def _find_course_node(data: Any) -> Optional[dict]:
    """Recursively locate the dict that holds the course's module→lesson tree.

    A "course" node is any dict with a module-like list (``modules``/``sections``/
    ``chapters``) whose entries themselves carry a lesson-like list. This lets the
    same parser handle the data whether it arrives as ``__PRELOADED_STATE__`` or
    nested inside an API envelope (``{data: {...}}``, ``{result: {...}}``, etc.).
    """
    stack: list[Any] = [data]
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            for mkey in _MODULE_KEYS:
                groups = cur.get(mkey)
                if isinstance(groups, list) and any(
                    isinstance(g, dict) and any(isinstance(g.get(lk), list) for lk in _LESSON_KEYS)
                    for g in groups
                ):
                    return cur
            stack.extend(cur.values())
        elif isinstance(cur, list):
            stack.extend(cur)
    return None


def _lessons_of(module: dict) -> list:
    for lk in _LESSON_KEYS:
        val = module.get(lk)
        if isinstance(val, list):
            return val
    return []


def _extract_course_tree(state: dict) -> dict:
    """Normalize a CoreApp data blob (state or API JSON) into the importer tree.

    Output shape (identical to ``stepik.fetch_course_tree``)::

        {title, sections: [{title, lessons: [{title, coreapp_id,
            steps: [{position, raw_html}]}]}]}

    Lesson bodies may be embedded inline (``blocks``) or fetched later by id.
    Raises ``CoreAppParsingError`` if no course node can be found, so a schema
    change surfaces loudly instead of importing an empty course.
    """
    course = _find_course_node(state)
    if not isinstance(course, dict):
        raise CoreAppParsingError(
            "В данных страницы CoreApp не найден объект курса (модули/уроки)."
        )

    raw_modules: list = []
    for mkey in _MODULE_KEYS:
        if isinstance(course.get(mkey), list):
            raw_modules = course[mkey]
            break
    sections_out: list[dict] = []
    for s_idx, module in enumerate(raw_modules):
        lessons_out: list[dict] = []
        for l_idx, lesson in enumerate(_lessons_of(module)):
            steps_out: list[dict] = []
            blocks = lesson.get("blocks")
            if blocks:
                text = _blocks_to_text(blocks)
                if text:
                    steps_out.append({"position": 1, "raw_html": text})
            lessons_out.append(
                {
                    "title": lesson.get("title") or lesson.get("name") or f"Урок {l_idx + 1}",
                    "coreapp_id": str(
                        lesson.get("id") or lesson.get("uuid") or lesson.get("slug") or ""
                    ),
                    "position": lesson.get("position", l_idx + 1),
                    "steps": steps_out,
                }
            )
        sections_out.append(
            {
                "title": module.get("title") or module.get("name") or f"Модуль {s_idx + 1}",
                "position": module.get("position", s_idx + 1),
                "lessons": lessons_out,
            }
        )

    return {
        "title": course.get("title") or course.get("name") or "Курс CoreApp",
        "sections": sections_out,
    }


# --------------------------------------------------------------------------- #
# Playwright parser
# --------------------------------------------------------------------------- #
class CoreappParser:
    """Headless-browser parser for a single CoreApp course.

    Usage::

        tree = await CoreappParser(request).run_parsing()
    """

    # CoreApp sign-in is a Blueprint (bp5) modal dialog tied to course access
    # ("course-auth"), NOT a standalone /login page. The bp5-tab ids are
    # app-defined and stable; the styled-component class hashes (yhZTs, bsTOdF,
    # evdzBN, ...) are build-generated and must NOT be relied on. We anchor to the
    # stable tab-panel id + input types, and the submit control is a <div> (not a
    # <button>) carrying the app class token "-course-auth".
    LOGIN_TAB = "#bp5-tab-title_payment-with-auth_login"
    LOGIN_PANEL = "#bp5-tab-panel_payment-with-auth_login"
    EMAIL_SELECTOR = f"{LOGIN_PANEL} form input:not([type=password])"
    PASSWORD_SELECTOR = f"{LOGIN_PANEL} form input[type=password]"
    SUBMIT_SELECTOR = ".Button[class~='-course-auth']"
    # Fallback control that opens the auth dialog if it isn't shown automatically.
    LOGIN_TRIGGER = "text=Войти"

    def __init__(
        self,
        request: CoreappParsingRequest,
        *,
        headless: bool = True,
        timeout_ms: int = 30_000,
    ) -> None:
        self.request = request
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.token: Optional[str] = None
        self.cookies: list[dict] = []
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    # -- lifecycle ---------------------------------------------------------- #
    async def _init_browser(self) -> None:
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise CoreAppParsingError(
                "Playwright не установлен. Добавьте 'playwright' в зависимости и "
                "выполните `playwright install chromium`."
            ) from exc

        self._playwright = await async_playwright().start()
        try:
            self._browser = await self._playwright.chromium.launch(headless=self.headless)
        except Exception as exc:  # browser binary missing, sandbox, etc.
            await self._cleanup()
            raise CoreAppParsingError(
                "Не удалось запустить headless-браузер. Установите движок командой "
                "`playwright install chromium`."
            ) from exc
        self._context = await self._browser.new_context(user_agent=_USER_AGENT)
        self._page = await self._context.new_page()
        self._page.set_default_timeout(self.timeout_ms)

    async def _cleanup(self) -> None:
        for closer in (
            getattr(self._context, "close", None),
            getattr(self._browser, "close", None),
            getattr(self._playwright, "stop", None),
        ):
            if closer is None:
                continue
            try:
                await closer()
            except Exception:  # noqa: BLE001 - teardown must never mask the real error
                pass

    # -- steps -------------------------------------------------------------- #
    async def authenticate(self) -> str:
        """Open the course-auth modal, log in, and capture the ``token`` cookie.

        CoreApp sets the session in an HttpOnly ``token`` cookie (plus
        ``is_logged_in=1``), which is invisible to page JS but readable through
        Playwright's ``context.cookies()``.
        """
        from playwright.async_api import TimeoutError as PWTimeoutError

        page = self._page
        assert page is not None  # _init_browser ran
        email = page.locator(self.EMAIL_SELECTOR).first

        # 1) Open the course page. Connectivity failures get their own message so
        #    "site unreachable" isn't confused with "login form not found".
        try:
            await page.goto(self.request.url, wait_until="domcontentloaded")
        except Exception as exc:  # noqa: BLE001 - DNS/timeout/refused/etc.
            raise CoreAppParsingError(
                f"Не удалось открыть страницу курса CoreApp ({self.request.url}). "
                f"Проверьте URL и доступность сайта. Детали: {str(exc)[:140]}"
            ) from exc

        # 2) Reveal + fill the login dialog. On failure we dump exactly what the
        #    parser sees so the real selectors/trigger can be pinned down.
        try:
            if not await email.is_visible():
                # Not auto-shown — try a "Войти" trigger to open the dialog.
                try:
                    await page.locator(self.LOGIN_TRIGGER).first.click(timeout=5_000)
                except PWTimeoutError:
                    pass
            # Ensure the "login" tab (not "register") is the active one.
            login_tab = page.locator(self.LOGIN_TAB).first
            if await login_tab.is_visible():
                await login_tab.click()
            await email.wait_for(timeout=self.timeout_ms)
            await email.fill(self.request.login)
            await page.locator(self.PASSWORD_SELECTOR).first.fill(self.request.password)
            await page.locator(self.SUBMIT_SELECTOR).first.click()
        except PWTimeoutError as exc:
            raise CoreAppAuthError(await self._login_failure_message(page)) from exc

        # 3) Wait for the auth cookie. The SPA never reaches networkidle, so poll
        #    for the `token` cookie instead of waiting on a load state.
        token = None
        for _ in range(20):
            self.cookies = await self._context.cookies()
            token = next((c["value"] for c in self.cookies if c["name"] == "token"), None)
            if token:
                break
            await page.wait_for_timeout(500)
        logged_in = any(
            c["name"] == "is_logged_in" and str(c["value"]) == "1" for c in self.cookies
        )
        if not token or not logged_in:
            raise CoreAppAuthError(
                "Вход в CoreApp не подтверждён — проверьте логин и пароль."
            )
        self.token = token
        return token

    async def _login_failure_message(self, page) -> str:
        """Diagnostic message when the login form can't be found/filled.

        Dumps what the parser actually sees (inputs/buttons/dialogs/bp5 tab ids)
        into the error, and saves a screenshot + HTML next to the backend so the
        real selectors/trigger can be pinned down. The page is the logged-OUT
        state, so it carries no credentials.
        """
        diag = "(диагностика недоступна)"
        try:
            data = await page.evaluate(
                """() => {
                  const inputs = [...document.querySelectorAll('input')].map(i => ({
                    type: i.type || '', name: i.name || '', ph: i.placeholder || '',
                    id: i.id || '', disabled: i.disabled,
                  }));
                  const btns = [...document.querySelectorAll('button, [role=button], .Button')]
                    .map(b => (b.innerText || '').trim().slice(0, 30)).filter(Boolean);
                  return {
                    url: location.href,
                    dialogs: document.querySelectorAll('[class*=dialog], [class*=Dialog], [role=dialog]').length,
                    tabIds: [...document.querySelectorAll('[id^=bp5-tab]')].map(e => e.id).slice(0, 12),
                    inputs: inputs.slice(0, 15),
                    buttons: [...new Set(btns)].slice(0, 20),
                  };
                }"""
            )
            diag = json.dumps(data, ensure_ascii=False)
        except Exception:  # noqa: BLE001
            pass
        saved = ""
        try:
            png = settings.project_root / "coreapp_login_debug.png"
            html = settings.project_root / "coreapp_login_debug.html"
            await page.screenshot(path=str(png))
            html.write_text(await page.content(), encoding="utf-8")
            saved = f" Скриншот и HTML сохранены в backend/: {png.name}, {html.name}."
        except Exception:  # noqa: BLE001
            pass
        return (
            "Не удалось открыть/заполнить форму входа CoreApp. Что парсер видит на "
            f"странице: {diag}.{saved}"
        )

    async def fetch_course_data(self) -> dict:
        """Sniff the (authenticated) course's own JSON API and build the tree.

        CoreApp renders client-side (no ``__PRELOADED_STATE__``), so instead of
        scraping the DOM we capture the JSON the SPA fetches and search it for the
        course structure. This stays entirely inside the user's backend — nothing
        is uploaded anywhere.
        """
        page = self._page
        assert page is not None

        responses: list = []
        def _collect(resp) -> None:
            responses.append(resp)
        page.on("response", _collect)
        # Reload the now-authenticated course so its API calls re-fire.
        await page.goto(self.request.url, wait_until="networkidle")
        page.remove_listener("response", _collect)

        # Read the JSON bodies after the fact (only same-ish API responses).
        captured: list[tuple[str, Any]] = []
        for resp in responses:
            try:
                if "application/json" in (resp.headers.get("content-type", "")):
                    captured.append((resp.url, await resp.json()))
            except Exception:  # noqa: BLE001 - non-JSON / already-consumed bodies
                continue

        # A global blob may still exist on some pages — try it first, then the API.
        state = await page.evaluate("() => window.__PRELOADED_STATE__ || null")
        candidates = ([state] if isinstance(state, dict) else []) + [b for _u, b in captured]
        for body in candidates:
            if not isinstance(body, dict):
                continue
            try:
                tree = _extract_course_tree(body)
            except CoreAppParsingError:
                continue
            if tree["sections"]:
                await self._backfill_lessons(tree)
                return tree

        # Couldn't auto-detect — surface the captured endpoint URLs (no bodies, no
        # secrets) so the structure parser can be pointed at the right one.
        urls = sorted({u for u, _b in captured})[:30]
        raise CoreAppParsingError(
            "Не удалось автоматически определить структуру курса CoreApp. "
            "Захваченные API-эндпоинты:\n" + ("\n".join(urls) or "(JSON-ответов не найдено)")
        )

    async def _backfill_lessons(self, tree: dict) -> None:
        """Fill lessons that had no inline body using the cookie-token HTTP path."""
        for section in tree["sections"]:
            for lesson in section["lessons"]:
                if lesson["steps"]:
                    continue
                coreapp_id = lesson.get("coreapp_id")
                if not coreapp_id:
                    continue
                text = await asyncio.to_thread(fetch_lesson_text, coreapp_id, self.token)
                if text:
                    lesson["steps"].append({"position": 1, "raw_html": text})

    async def run_parsing(self) -> dict:
        """Full lifecycle: launch → authenticate → fetch → teardown."""
        try:
            await self._init_browser()
            await self.authenticate()
            return await self.fetch_course_data()
        finally:
            await self._cleanup()


# --------------------------------------------------------------------------- #
# Persistence — shares the importer/stepik tree shape
# --------------------------------------------------------------------------- #
def import_course_from_coreapp(
    db: Session,
    course_id: int,
    request: CoreappParsingRequest,
) -> Course:
    """Parse a CoreApp course (login + walk) and persist it into ``course_id``."""
    course = db.get(Course, course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found")

    # Drive the async parser to completion from this synchronous worker.
    tree = asyncio.run(CoreappParser(request).run_parsing())

    # Replace previous structure (re-import is destructive, same as Stepik).
    for section in list(course.sections):
        db.delete(section)
    db.flush()

    if not (course.title or "").strip():
        course.title = tree.get("title", course.title)

    steps_total = sum(
        len(l.get("steps", []))
        for s in tree.get("sections", [])
        for l in s.get("lessons", [])
    )
    course.import_steps_total = steps_total
    course.import_steps_done = 0
    db.commit()

    done = 0
    COMMIT_EVERY = 25
    for s_idx, s_data in enumerate(tree.get("sections", []), start=1):
        section = Section(
            course_id=course.id,
            title=s_data.get("title", f"Модуль {s_idx}"),
            position=s_data.get("position", s_idx),
        )
        db.add(section)
        db.flush()
        for l_idx, l_data in enumerate(s_data.get("lessons", []), start=1):
            lesson = Lesson(
                section_id=section.id,
                title=l_data.get("title", f"Урок {l_idx}"),
                position=l_data.get("position", l_idx),
            )
            db.add(lesson)
            db.flush()
            for st_idx, st_data in enumerate(l_data.get("steps", []), start=1):
                raw_html = st_data.get("raw_html", st_data.get("content", ""))
                db.add(
                    Step(
                        lesson_id=lesson.id,
                        position=st_data.get("position", st_idx),
                        raw_html=raw_html,
                        content_text=clean_html(raw_html),
                        step_url=f"{settings.coreapp_base.rstrip('/')}/player/lesson/{l_data.get('coreapp_id', '')}",
                    )
                )
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
