"""End-to-end API tests."""
from __future__ import annotations

import io
import json
import time
import zipfile

from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def _wait_for_import(client: TestClient, course_id: int, timeout: float = 5.0) -> dict:
    """Poll /import-status until status leaves "running"."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/courses/{course_id}/import-status")
        assert r.status_code == 200, r.text
        body = r.json()
        if body["status"] in ("done", "error"):
            return body
        time.sleep(0.05)
    raise AssertionError(f"Import did not finish within {timeout}s")


def _make_course_with_import(client: TestClient) -> int:
    r = client.post("/courses/", json={"title": "SQL", "url": ""})
    assert r.status_code == 201, r.text
    course_id = r.json()["id"]

    r = client.post(f"/courses/{course_id}/import", json={"source": "mock"})
    assert r.status_code == 202, r.text
    status_body = _wait_for_import(client, course_id)
    assert status_body["status"] == "done", status_body
    assert status_body["sections_count"] == 3
    assert status_body["lessons_count"] >= 7
    assert status_body["steps_count"] >= 20
    return course_id


def test_course_import_and_full_read(client: TestClient) -> None:
    course_id = _make_course_with_import(client)
    r = client.get(f"/courses/{course_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["is_parsed"] is True
    assert len(data["sections"]) == 3
    first_lesson = data["sections"][0]["lessons"][0]
    assert len(first_lesson["steps"]) >= 1
    assert first_lesson["steps"][0]["name"].startswith("Шаг ")


def test_glossary_bulk_collect_search(client: TestClient) -> None:
    course_id = _make_course_with_import(client)

    r = client.post(f"/glossaries/?course_id={course_id}", json={"title": "Г1"})
    assert r.status_code == 201, r.text
    glossary_id = r.json()["id"]

    r = client.post(
        f"/glossaries/{glossary_id}/terms/bulk",
        json={"names": ["SELECT", "JOIN", "WHERE", "", "SELECT"]},
    )
    assert r.status_code == 201
    terms = r.json()
    assert len(terms) == 3  # duplicates and empty stripped

    r = client.post(
        f"/glossaries/{glossary_id}/collect", json={"term_ids": []}
    )
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["terms_processed"] == 3
    assert report["bindings_created"] > 0

    # The glossary now has terms with bindings.
    r = client.get(f"/glossaries/{glossary_id}")
    full = r.json()
    total_bindings = sum(len(t["bindings"]) for t in full["terms"])
    assert total_bindings == report["bindings_created"]

    # Each term should have at least one primary binding.
    for t in full["terms"]:
        if t["bindings"]:
            assert any(b["is_primary"] for b in t["bindings"]) is True

    # Search.
    r = client.get(f"/courses/{course_id}/search", params={"q": "SELECT"})
    assert r.status_code == 200
    hits = r.json()
    assert len(hits) > 0
    assert "step_url" in hits[0]


def test_scorm_zip(client: TestClient) -> None:
    course_id = _make_course_with_import(client)
    r = client.post(f"/glossaries/?course_id={course_id}", json={"title": "G"})
    glossary_id = r.json()["id"]
    client.post(
        f"/glossaries/{glossary_id}/terms/bulk", json={"names": ["SELECT"]}
    )

    r = client.post(
        f"/glossaries/{glossary_id}/scorm",
        json={"scorm_id": "TEST-1", "version": "1.2"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    buf = io.BytesIO(r.content)
    with zipfile.ZipFile(buf) as zf:
        names = set(zf.namelist())
        assert "imsmanifest.xml" in names
        assert "data.json" in names
        assert "index.html" in names
        manifest = zf.read("imsmanifest.xml").decode("utf-8")
        assert "<schemaversion>1.2</schemaversion>" in manifest
        index_html = zf.read("index.html").decode("utf-8")
        assert "vis-network" in index_html
        data = json.loads(zf.read("data.json").decode("utf-8"))
        assert data["glossary"]["title"] == "G"


def test_binding_duplicate_409(client: TestClient) -> None:
    course_id = _make_course_with_import(client)
    full = client.get(f"/courses/{course_id}").json()
    step_id = full["sections"][0]["lessons"][0]["steps"][0]["id"]

    glossary_id = client.post(
        f"/glossaries/?course_id={course_id}", json={"title": "G"}
    ).json()["id"]
    term_id = client.post(
        f"/glossaries/{glossary_id}/terms/",
        json={"name": "Тест", "definition": ""},
    ).json()["id"]

    r1 = client.post(
        "/bindings/",
        json={
            "term_id": term_id,
            "step_id": step_id,
            "is_primary": True,
            "is_created_by_user": True,
        },
    )
    assert r1.status_code == 200, r1.text
    first_id = r1.json()["id"]

    # POST is idempotent on (term_id, step_id): a duplicate returns the same
    # binding with 200, not 409. This matches the LinkEditor "save my checks"
    # UX which doesn't track whether the binding already exists.
    r2 = client.post(
        "/bindings/",
        json={
            "term_id": term_id,
            "step_id": step_id,
            "is_primary": False,
            "is_created_by_user": True,
        },
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == first_id
