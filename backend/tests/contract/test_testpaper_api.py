"""Contract tests for the test paper routes (T024).

Per docs/specifications/api-endpoints.md (TestPaperOut in api-spec.yaml):
  GET  /api/exams/{exam_id}/test-papers        → 200 TestPaperOut[]            | 404
  POST /api/exams/{exam_id}/test-papers        → 201 TestPaperOut (owner/admin) | 403 | 404
  POST /api/test-papers/{paper_id}/questions   → 200 { added: int } (owner/admin)| 403 | 404

RED phase: the test paper routes are not implemented yet (T025), so these
calls hit 404 and the tests fail. They turn green once the routes exist.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _register(client: AsyncClient, email: str, role: str = "student") -> str:
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "name": email.split("@")[0], "password": "SecurePass1!", "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_exam(client: AsyncClient, token: str) -> str:
    r = await client.post(
        "/api/exams", headers=_auth(token), json={"title": "Exam", "exam_type": "JEE"}
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _create_subject(client: AsyncClient, token: str, exam_id: str) -> str:
    r = await client.post(
        f"/api/exams/{exam_id}/subjects", headers=_auth(token), json={"name": "Physics"}
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _create_question(client: AsyncClient, token: str, subject_id: str) -> str:
    r = await client.post(
        "/api/questions",
        headers=_auth(token),
        json={
            "subject_id": subject_id,
            "text": "Q?",
            "difficulty": "easy",
            "options": [
                {"option_key": "A", "text": "1", "is_correct": True},
                {"option_key": "B", "text": "2", "is_correct": False},
                {"option_key": "C", "text": "3", "is_correct": False},
                {"option_key": "D", "text": "4", "is_correct": False},
            ],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _papers_url(exam_id: str) -> str:
    return f"/api/exams/{exam_id}/test-papers"


def _paper_payload(**overrides) -> dict:
    payload = {
        "title": "Mock Test 1",
        "duration_seconds": 7200,
        "total_marks": 100,
    }
    payload.update(overrides)
    return payload


async def _create_paper(client: AsyncClient, token: str, exam_id: str, **overrides) -> dict:
    r = await client.post(
        _papers_url(exam_id), headers=_auth(token), json=_paper_payload(**overrides)
    )
    assert r.status_code == 201, r.text
    return r.json()


# ─── List ───────────────────────────────────────────────
async def test_list_test_papers_requires_auth(client: AsyncClient):
    teacher = await _register(client, "tp_list_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.get(_papers_url(exam_id))
    assert r.status_code == 401


async def test_list_test_papers_empty_for_new_exam(client: AsyncClient):
    teacher = await _register(client, "tp_empty_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.get(_papers_url(exam_id), headers=_auth(teacher))
    assert r.status_code == 200
    assert r.json() == []


async def test_list_test_papers_nonexistent_exam_returns_404(client: AsyncClient):
    token = await _register(client, "tp_list_404@example.com")
    r = await client.get(_papers_url(str(uuid4())), headers=_auth(token))
    assert r.status_code == 404


# ─── Create ─────────────────────────────────────────────
async def test_create_test_paper_as_teacher_returns_201(client: AsyncClient):
    teacher = await _register(client, "tp_create_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.post(
        _papers_url(exam_id), headers=_auth(teacher), json=_paper_payload()
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "Mock Test 1"
    assert body["duration_seconds"] == 7200
    assert float(body["total_marks"]) == 100
    assert float(body["negative_marking_factor"]) == 0.25  # default per contract
    assert body["shuffle_questions"] is False
    assert body["shuffle_options"] is False
    assert {"id", "exam_id", "created_at"} <= body.keys()
    assert body["exam_id"] == exam_id


async def test_create_test_paper_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "tp_owner_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    student = await _register(client, "tp_student@example.com")
    r = await client.post(_papers_url(exam_id), headers=_auth(student), json=_paper_payload())
    assert r.status_code == 403


async def test_create_test_paper_requires_auth(client: AsyncClient):
    r = await client.post(_papers_url(str(uuid4())), json=_paper_payload())
    assert r.status_code == 401


async def test_create_test_paper_missing_required_returns_422(client: AsyncClient):
    teacher = await _register(client, "tp_422_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    payload = _paper_payload()
    del payload["duration_seconds"]
    r = await client.post(_papers_url(exam_id), headers=_auth(teacher), json=payload)
    assert r.status_code == 422


async def test_create_test_paper_nonexistent_exam_returns_404(client: AsyncClient):
    teacher = await _register(client, "tp_create_404_t@example.com", role="teacher")
    r = await client.post(
        _papers_url(str(uuid4())), headers=_auth(teacher), json=_paper_payload()
    )
    assert r.status_code == 404


async def test_created_test_paper_appears_in_list(client: AsyncClient):
    teacher = await _register(client, "tp_roundtrip_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    created = await _create_paper(client, teacher, exam_id, title="Mock Test A")
    r = await client.get(_papers_url(exam_id), headers=_auth(teacher))
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert created["id"] in ids


# ─── Add questions ──────────────────────────────────────
def _questions_url(paper_id: str) -> str:
    return f"/api/test-papers/{paper_id}/questions"


async def test_add_questions_returns_added_count(client: AsyncClient):
    teacher = await _register(client, "tp_addq_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    subject_id = await _create_subject(client, teacher, exam_id)
    q1 = await _create_question(client, teacher, subject_id)
    q2 = await _create_question(client, teacher, subject_id)
    paper = await _create_paper(client, teacher, exam_id)
    r = await client.post(
        _questions_url(paper["id"]),
        headers=_auth(teacher),
        json={
            "question_ids": [
                {"question_id": q1, "display_order": 1, "marks": 4, "negative_marks": 1},
                {"question_id": q2, "display_order": 2},
            ]
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["added"] == 2


async def test_add_questions_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "tp_addq_owner_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    subject_id = await _create_subject(client, teacher, exam_id)
    q1 = await _create_question(client, teacher, subject_id)
    paper = await _create_paper(client, teacher, exam_id)
    student = await _register(client, "tp_addq_student@example.com")
    r = await client.post(
        _questions_url(paper["id"]),
        headers=_auth(student),
        json={"question_ids": [{"question_id": q1, "display_order": 1}]},
    )
    assert r.status_code == 403


async def test_add_questions_requires_auth(client: AsyncClient):
    r = await client.post(
        _questions_url(str(uuid4())),
        json={"question_ids": [{"question_id": str(uuid4()), "display_order": 1}]},
    )
    assert r.status_code == 401


async def test_add_questions_nonexistent_paper_returns_404(client: AsyncClient):
    teacher = await _register(client, "tp_addq_404_t@example.com", role="teacher")
    r = await client.post(
        _questions_url(str(uuid4())),
        headers=_auth(teacher),
        json={"question_ids": [{"question_id": str(uuid4()), "display_order": 1}]},
    )
    assert r.status_code == 404
