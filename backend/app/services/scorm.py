"""SCORM 1.2 / 2004 ZIP package builder.

The package ships the *same* built front-end (``app/scorm_player/``, produced by
``npm run build``) running in read-only "player" mode. At export time we inject
a ``scorm-data.js`` that sets ``window.__LW_GLOSSARY__`` (the glossary + course
tree + bindings, in the exact shape the app's API adapter consumes) plus a
``scorm-api.js`` SCORM runtime shim, then zip the whole bundle with an
``imsmanifest.xml``. So the exported view is identical to the editor, minus the
dashboard and all editing affordances.

Built entirely in memory (``io.BytesIO`` + ``zipfile``).
"""
from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from typing import Literal
from xml.sax.saxutils import escape

from sqlalchemy.orm import Session

from app.models import Glossary

ScormVersion = Literal["1.2", "2004"]

# backend/app/scorm_player — committed output of the front-end production build.
_PLAYER_DIR = Path(__file__).resolve().parent.parent / "scorm_player"


# --------------------------------------------------------------------------- #
# Data payload — mirrors ApiCourseFull / ApiGlossaryFull so the front-end's
# mapCourseFull() produces byte-identical state to the live editor.
# --------------------------------------------------------------------------- #
def _course_payload(course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "url": course.url,
        "is_parsed": course.is_parsed,
        "import_date": course.import_date.isoformat() if course.import_date else None,
        "sections": [
            {
                "id": sec.id,
                "course_id": sec.course_id,
                "title": sec.title,
                "position": sec.position,
                "is_indexed": sec.is_indexed,
                "lessons": [
                    {
                        "id": l.id,
                        "section_id": l.section_id,
                        "title": l.title,
                        "position": l.position,
                        "is_indexed": l.is_indexed,
                        "steps": [
                            {
                                "id": st.id,
                                "lesson_id": st.lesson_id,
                                "position": st.position,
                                "step_url": st.step_url,
                                # Matches StepRead.name populated by the courses router.
                                "name": f"Шаг {st.position}",
                            }
                            for st in l.steps
                        ],
                    }
                    for l in sec.lessons
                ],
            }
            for sec in course.sections
        ],
    }


def _glossary_payload(glossary: Glossary) -> dict:
    return {
        "id": glossary.id,
        "course_id": glossary.course_id,
        "title": glossary.title,
        "text_content": glossary.text_content,
        "terms": [
            {
                "id": t.id,
                "glossary_id": t.glossary_id,
                "name": t.name,
                "definition": t.definition,
                "bindings": [
                    {
                        "id": b.id,
                        "term_id": b.term_id,
                        "step_id": b.step_id,
                        "is_primary": b.is_primary,
                        "is_created_by_user": b.is_created_by_user,
                    }
                    for b in t.bindings
                ],
            }
            for t in glossary.terms
        ],
    }


def _build_payload(glossary: Glossary) -> dict:
    return {
        "course": _course_payload(glossary.course),
        "glossaries": [_glossary_payload(glossary)],
        "activeGlossaryId": glossary.id,
    }


# --------------------------------------------------------------------------- #
# SCORM runtime shim — finds the LMS API and reports completion. Supports both
# SCORM 1.2 (window.API) and 2004 (window.API_1484_11).
# --------------------------------------------------------------------------- #
def _scorm_api_js(version: ScormVersion) -> str:
    if version == "1.2":
        return r"""(function () {
  function find(win) {
    var n = 0;
    while (win && n++ < 12) {
      if (win.API) return win.API;
      win = win.parent === win ? null : win.parent;
    }
    return (window.opener && window.opener.API) || null;
  }
  var api = find(window);
  if (!api) return;
  try {
    api.LMSInitialize("");
    api.LMSSetValue("cmi.core.lesson_status", "completed");
    api.LMSCommit("");
    window.addEventListener("unload", function () { try { api.LMSFinish(""); } catch (e) {} });
  } catch (e) { /* no LMS — standalone preview */ }
})();
"""
    return r"""(function () {
  function find(win) {
    var n = 0;
    while (win && n++ < 12) {
      if (win.API_1484_11) return win.API_1484_11;
      win = win.parent === win ? null : win.parent;
    }
    return (window.opener && window.opener.API_1484_11) || null;
  }
  var api = find(window);
  if (!api) return;
  try {
    api.Initialize("");
    api.SetValue("cmi.completion_status", "completed");
    api.SetValue("cmi.success_status", "passed");
    api.Commit("");
    window.addEventListener("unload", function () { try { api.Terminate(""); } catch (e) {} });
  } catch (e) { /* no LMS — standalone preview */ }
})();
"""


# --------------------------------------------------------------------------- #
# Manifest
# --------------------------------------------------------------------------- #
def _manifest_xml(course_title: str, scorm_id: str, version: ScormVersion, files: list[str]) -> str:
    schema = (
        "<schema>ADL SCORM</schema><schemaversion>1.2</schemaversion>"
        if version == "1.2"
        else "<schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion>"
    )
    title = escape(course_title or "Глоссарий")
    file_tags = "\n      ".join(f'<file href="{escape(f)}"/>' for f in files)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{escape(scorm_id)}" version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>{schema}</metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>{title}</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>{title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      {file_tags}
    </resource>
  </resources>
</manifest>
"""


class ScormPlayerMissing(RuntimeError):
    """Raised when the prebuilt front-end player bundle isn't present."""


def build_scorm_zip(
    db: Session,
    glossary: Glossary,
    scorm_id: str,
    version: ScormVersion = "1.2",
) -> bytes:
    """Build a SCORM ZIP bundling the read-only app + this glossary's data."""
    index_path = _PLAYER_DIR / "index.html"
    if not index_path.exists():
        raise ScormPlayerMissing(
            "Не найден собранный плеер (backend/app/scorm_player/index.html). "
            "Соберите фронтенд: `npm run build` и скопируйте dist/ в "
            "backend/app/scorm_player/."
        )

    payload = _build_payload(glossary)
    data_js = (
        "window.__LW_SCORM__ = true;\n"
        "window.__LW_GLOSSARY__ = "
        + json.dumps(payload, ensure_ascii=False)
        + ";\n"
    )
    api_js = _scorm_api_js(version)

    # Inject our two classic scripts BEFORE the app's deferred module script so
    # the globals exist before React boots.
    index_html = index_path.read_text(encoding="utf-8")
    inject = (
        '<script src="./scorm-api.js"></script>\n'
        '    <script src="./scorm-data.js"></script>\n    '
    )
    if '<script type="module"' in index_html:
        index_html = index_html.replace('<script type="module"', inject + '<script type="module"', 1)
    else:  # fallback: before </head>
        index_html = index_html.replace("</head>", inject + "</head>", 1)

    # Gather the static asset files (everything under the player dir except the
    # index.html we rewrite above).
    asset_files = [
        p for p in _PLAYER_DIR.rglob("*")
        if p.is_file() and p.name != "index.html"
    ]
    manifest_files = (
        ["index.html", "scorm-data.js", "scorm-api.js"]
        + [p.relative_to(_PLAYER_DIR).as_posix() for p in asset_files]
    )
    manifest = _manifest_xml(glossary.course.title, scorm_id, version, manifest_files)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("imsmanifest.xml", manifest)
        zf.writestr("index.html", index_html)
        zf.writestr("scorm-data.js", data_js)
        zf.writestr("scorm-api.js", api_js)
        for p in asset_files:
            zf.writestr(p.relative_to(_PLAYER_DIR).as_posix(), p.read_bytes())
    return buf.getvalue()
