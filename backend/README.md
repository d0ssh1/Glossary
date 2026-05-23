# Lexicon Weaver — Backend

FastAPI + SQLAlchemy 2.0 + SQLite (FTS5) backend for the Lexicon Weaver
graph-based glossary editor.

## Install

```bash
cd backend
py -m pip install -r requirements.txt
```

## Run

```bash
py -m uvicorn app.main:app --reload --port 8000
```

The first launch creates `lexicon_weaver.db`, builds the FTS5 index, and
auto-seeds a demo course + glossary from `mock_data/sample_course.json`.

OpenAPI docs are served at <http://localhost:8000/docs>.

## Test

```bash
py -m pytest -x
```

Tests use a temporary SQLite file (no overlap with the dev database).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/health` | Liveness probe |
| GET    | `/courses/` | List courses |
| POST   | `/courses/` | Create course |
| GET    | `/courses/{id}` | Full course tree |
| DELETE | `/courses/{id}` | Delete course |
| POST   | `/courses/{id}/import` | Import from JSON dump |
| PATCH  | `/courses/{id}/sections/{sid}` | Toggle section `is_indexed` |
| PATCH  | `/courses/{id}/lessons/{lid}` | Toggle lesson `is_indexed` |
| GET    | `/courses/{id}/search?q=...` | FTS5 search |
| GET    | `/glossaries/?course_id=...` | List glossaries |
| POST   | `/glossaries/?course_id=...` | Create glossary |
| GET    | `/glossaries/{id}` | Glossary with terms |
| PATCH  | `/glossaries/{id}` | Update glossary |
| DELETE | `/glossaries/{id}` | Delete glossary |
| POST   | `/glossaries/{id}/collect` | Auto-bind terms via FTS |
| POST   | `/glossaries/{id}/scorm` | Download SCORM ZIP |
| GET    | `/glossaries/{gid}/terms/` | List terms |
| POST   | `/glossaries/{gid}/terms/` | Create term |
| POST   | `/glossaries/{gid}/terms/bulk` | Bulk create terms |
| PATCH  | `/glossaries/{gid}/terms/{tid}` | Update term |
| DELETE | `/glossaries/{gid}/terms/{tid}` | Delete term |
| GET    | `/glossaries/{gid}/terms/{tid}/occurrences` | Term occurrences |
| POST   | `/bindings/` | Create binding (409 on duplicate) |
| PATCH  | `/bindings/{id}` | Update binding flags |
| DELETE | `/bindings/{id}` | Delete binding |

## JSON dump format

```json
{
  "title": "...",
  "stepik_id": 12345,
  "sections": [
    {
      "title": "...",
      "position": 1,
      "lessons": [
        {
          "title": "...",
          "position": 1,
          "stepik_id": 9000,
          "steps": [
            { "position": 1, "raw_html": "<p>...</p>" }
          ]
        }
      ]
    }
  ]
}
```

Files in `mock_data/` are picked up by `POST /courses/{id}/import` when
`source` is `"mock"` (default file) or `"json"` with an explicit `filename`.

## Configuration

Environment variables (prefix `LW_`):

- `LW_DATABASE_URL` — SQLAlchemy URL, default `sqlite:///./lexicon_weaver.db`
- `LW_CORS_ORIGINS` — CSV list of allowed CORS origins
- `LW_MOCK_DATA_DIR` — path to JSON dumps directory
