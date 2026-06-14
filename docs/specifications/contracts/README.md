# API Contract Testing — QuizzerApp

**Last Updated**: 2026-06-14  
**Spec**: `docs/specifications/contracts/api-spec.yaml` (OpenAPI 3.0)

---

## What Are Contract Tests?

Contract tests validate that the API behaves exactly as the `api-spec.yaml` specifies — request shapes, response schemas, status codes, and error formats. They are written BEFORE implementation (TDD) and run against a real test database.

**Rule**: No route implementation without a passing contract test that first fails.

---

## Test Structure

```
backend/tests/
├── conftest.py               # pytest fixtures: async client, test DB session, seed data
├── contract/
│   ├── test_auth_api.py      # Auth route contracts ✅ (done implicitly via implementation)
│   ├── test_exam_api.py      # Exam/Subject/Topic routes — T019
│   ├── test_question_api.py  # Question/Option routes — T022
│   ├── test_testpaper_api.py # Test paper routes — T024
│   ├── test_attempt_api.py   # Attempt/Answer routes — T031
│   ├── test_analysis_api.py  # All 9 analysis endpoints — T042
│   └── test_rag_api.py       # RAG upload/generate/save routes — T055
└── integration/
    └── test_exam_flow.py     # Full journey: create exam → attempt → analysis
```

---

## Fixtures (conftest.py)

```python
# backend/tests/conftest.py

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import get_async_session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

TEST_DB_URL = "postgresql+asyncpg://user:pass@localhost/quizzerapp_test"

@pytest.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db(db_engine):
    async with AsyncSession(db_engine) as session:
        yield session
        await session.rollback()  # reset after each test

@pytest.fixture
async def client(db):
    async def override_db():
        yield db
    app.dependency_overrides[get_async_session] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
async def student_token(client):
    # Register + login a student, return access_token
    r = await client.post("/api/auth/register", json={
        "email": "student@test.com", "name": "Test Student", "password": "testpass123"
    })
    return r.json()["access_token"]

@pytest.fixture
async def teacher_token(client):
    # Register + login a teacher
    r = await client.post("/api/auth/register", json={
        "email": "teacher@test.com", "name": "Test Teacher",
        "password": "testpass123", "role": "teacher"
    })
    return r.json()["access_token"]
```

---

## Contract Test Pattern

Every contract test follows this structure:

```python
# backend/tests/contract/test_exam_api.py

import pytest
from httpx import AsyncClient

class TestCreateExam:
    async def test_teacher_can_create_exam(self, client: AsyncClient, teacher_token: str):
        response = await client.post(
            "/api/exams",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={"title": "JEE Mock 1", "description": "Full syllabus", "exam_type": "JEE"}
        )
        assert response.status_code == 201
        data = response.json()
        # Validate response shape matches api-spec.yaml ExamOut
        assert "id" in data
        assert data["title"] == "JEE Mock 1"
        assert data["exam_type"] == "JEE"
        assert data["is_published"] is False
        assert "created_at" in data

    async def test_student_cannot_create_exam(self, client: AsyncClient, student_token: str):
        response = await client.post(
            "/api/exams",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"title": "Unauthorized", "exam_type": "Custom"}
        )
        assert response.status_code == 403

    async def test_missing_required_fields_returns_422(self, client: AsyncClient, teacher_token: str):
        response = await client.post(
            "/api/exams",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={"title": "No exam_type"}  # missing exam_type
        )
        assert response.status_code == 422
        assert "exam_type" in str(response.json()["detail"])

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        response = await client.post("/api/exams", json={"title": "x", "exam_type": "JEE"})
        assert response.status_code == 401
```

---

## Running Contract Tests

```bash
cd backend

# Run all contract tests
uv run pytest tests/contract/ -v

# Run a specific contract test file
uv run pytest tests/contract/test_exam_api.py -v

# Run with coverage
uv run pytest tests/contract/ --cov=app --cov-report=term-missing

# Run a single test class
uv run pytest tests/contract/test_exam_api.py::TestCreateExam -v
```

---

## TDD Workflow

```
1. Write test → run → confirm RED (route doesn't exist → 404 or import error)
2. Implement minimal route → run → confirm GREEN
3. Add edge case tests (403, 422, 404) → run → confirm RED
4. Extend implementation → run → confirm GREEN
5. Repeat until all contract cases pass
```

---

## What to Validate in Contract Tests

For every endpoint, test at minimum:

| Test case | Expected |
|---|---|
| Happy path (correct auth + valid body) | 200/201 with correct schema |
| Missing required field | 422 with field name in detail |
| Wrong role (e.g., student on teacher route) | 403 |
| No auth header | 401 |
| Non-existent resource | 404 with `"detail": "... not found"` |
| Duplicate (unique constraint) | 409 or 422 |

---

## OpenAPI Spec

The `api-spec.yaml` in this directory is the authoritative source for:
- All request body schemas
- All response body schemas
- Status codes per operation
- Auth requirements

When you add a new endpoint:
1. Add it to `api-spec.yaml` first
2. Write the contract test based on the spec
3. Implement the route to pass the test
