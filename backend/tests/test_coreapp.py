"""CoreApp parser: pure helpers + import-route validation (no browser)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.schemas import CoreappParsingRequest
from app.services.coreapp import (
    CoreAppParsingError,
    _blocks_to_text,
    _extract_course_tree,
)


def test_request_schema_requires_all_fields() -> None:
    req = CoreappParsingRequest(url="https://coreapp.ai/course/1", login="a@b.c", password="pw")
    assert req.url.endswith("/course/1")
    assert req.login == "a@b.c"
    with pytest.raises(Exception):
        CoreappParsingRequest(url="x", login="a@b.c")  # missing password


def test_blocks_to_text_keeps_only_text_blocks() -> None:
    blocks = {
        "b1": {"type": "Text", "content": {"text": "<p>Привет, <b>мир</b></p>"}},
        "b2": {"type": "Video", "content": {"url": "http://x"}},
        "b3": {"type": "Text", "content": {"text": "<p>Второй абзац.</p>"}},
    }
    text = _blocks_to_text(blocks)
    assert "Привет" in text and "мир" in text
    assert "Второй абзац." in text
    assert "http://x" not in text  # video block skipped


def test_blocks_to_text_handles_list_shape() -> None:
    blocks = [{"type": "Text", "content": {"text": "<p>Список</p>"}}]
    assert _blocks_to_text(blocks) == "Список"


def test_extract_course_tree_normalizes_modules_and_lessons() -> None:
    state = {
        "course": {
            "title": "Демо-курс",
            "modules": [
                {
                    "title": "Модуль 1",
                    "lessons": [
                        {
                            "id": 10,
                            "title": "Урок 1",
                            "blocks": {"b1": {"type": "Text", "content": {"text": "<p>Содержимое</p>"}}},
                        },
                        {"id": 11, "title": "Урок 2", "blocks": []},
                    ],
                }
            ],
        }
    }
    tree = _extract_course_tree(state)
    assert tree["title"] == "Демо-курс"
    assert len(tree["sections"]) == 1
    section = tree["sections"][0]
    assert section["title"] == "Модуль 1"
    assert len(section["lessons"]) == 2
    # Inline blocks become a step; empty lesson is left for runtime backfill.
    assert section["lessons"][0]["steps"][0]["raw_html"] == "Содержимое"
    assert section["lessons"][0]["coreapp_id"] == "10"
    assert section["lessons"][1]["steps"] == []


def test_extract_course_tree_finds_nested_api_envelope() -> None:
    # Course buried in an API envelope, using "items" instead of "lessons".
    body = {
        "data": {
            "course": {
                "name": "API-курс",
                "sections": [
                    {"name": "Раздел 1", "items": [{"id": "abc", "name": "Урок A"}]},
                ],
            }
        }
    }
    tree = _extract_course_tree(body)
    assert tree["title"] == "API-курс"
    assert tree["sections"][0]["title"] == "Раздел 1"
    assert tree["sections"][0]["lessons"][0]["title"] == "Урок A"
    assert tree["sections"][0]["lessons"][0]["coreapp_id"] == "abc"


def test_extract_course_tree_raises_without_course() -> None:
    with pytest.raises(CoreAppParsingError):
        _extract_course_tree({"player": {"blocks": {}}})
    with pytest.raises(CoreAppParsingError):
        _extract_course_tree({"data": {"unrelated": [1, 2, 3]}})


def test_import_route_requires_credentials(client: TestClient) -> None:
    course_id = client.post(
        "/courses/", json={"title": "C", "url": "https://coreapp.ai/course/1"}
    ).json()["id"]
    r = client.post(f"/courses/{course_id}/import", json={"source": "coreapp"})
    assert r.status_code == 422
    assert "coreapp_login" in r.json()["detail"]


def test_import_route_requires_course_url(client: TestClient) -> None:
    course_id = client.post("/courses/", json={"title": "C", "url": ""}).json()["id"]
    r = client.post(
        f"/courses/{course_id}/import",
        json={"source": "coreapp", "coreapp_login": "a@b.c", "coreapp_password": "pw"},
    )
    assert r.status_code == 422
    assert "URL" in r.json()["detail"]
