"""Contract tests for the subject routes (T021).

  GET  /api/exams/{exam_id}/subjects → 200 SubjectOut[] (topics nested) | 404
  POST /api/exams/{exam_id}/subjects → 201 SubjectOut (teacher/admin) | 403 | 404

Validated against docs/specifications/contracts/api-spec.yaml. RED until the
subject routes are added to exams.py.
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


def _subjects_url(exam_id: str) -> str:
    return f"/api/exams/{exam_id}/subjects"


# ─── List ───────────────────────────────────────────────
async def test_list_subjects_requires_auth(client: AsyncClient):
    teacher = await _register(client, "subj_list_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.get(_subjects_url(exam_id))
    assert r.status_code == 401


async def test_list_subjects_empty_for_new_exam(client: AsyncClient):
    teacher = await _register(client, "subj_empty_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.get(_subjects_url(exam_id), headers=_auth(teacher))
    assert r.status_code == 200
    assert r.json() == []


async def test_list_subjects_nonexistent_exam_returns_404(client: AsyncClient):
    token = await _register(client, "subj_404@example.com")
    r = await client.get(_subjects_url(str(uuid4())), headers=_auth(token))
    assert r.status_code == 404


# ─── Create ─────────────────────────────────────────────
async def test_create_subject_as_teacher_returns_201(client: AsyncClient):
    teacher = await _register(client, "subj_create_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.post(
        _subjects_url(exam_id), headers=_auth(teacher), json={"name": "Physics", "order_index": 1}
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Physics"
    assert body["order_index"] == 1
    assert body["topics"] == []  # nested topics, empty for a new subject
    assert "id" in body


async def test_create_subject_defaults_order_index(client: AsyncClient):
    teacher = await _register(client, "subj_default_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    r = await client.post(_subjects_url(exam_id), headers=_auth(teacher), json={"name": "Chemistry"})
    assert r.status_code == 201
    assert r.json()["order_index"] == 0


async def test_create_subject_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "subj_owner_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    student = await _register(client, "subj_student@example.com")
    r = await client.post(_subjects_url(exam_id), headers=_auth(student), json={"name": "Maths"})
    assert r.status_code == 403


async def test_create_subject_nonexistent_exam_returns_404(client: AsyncClient):
    teacher = await _register(client, "subj_create_404_t@example.com", role="teacher")
    r = await client.post(
        _subjects_url(str(uuid4())), headers=_auth(teacher), json={"name": "Physics"}
    )
    assert r.status_code == 404


# ─── Create then list (ordering) ────────────────────────
async def test_subjects_listed_in_order_index(client: AsyncClient):
    teacher = await _register(client, "subj_order_t@example.com", role="teacher")
    exam_id = await _create_exam(client, teacher)
    await client.post(_subjects_url(exam_id), headers=_auth(teacher), json={"name": "B", "order_index": 2})
    await client.post(_subjects_url(exam_id), headers=_auth(teacher), json={"name": "A", "order_index": 1})
    r = await client.get(_subjects_url(exam_id), headers=_auth(teacher))
    assert r.status_code == 200
    names = [s["name"] for s in r.json()]
    assert names == ["A", "B"]
