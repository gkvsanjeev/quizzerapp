"""Contract tests for the exam routes (T019).

Validated against docs/specifications/contracts/api-spec.yaml:
  GET  /api/exams            → 200 PaginatedResponse{total,page,limit,items:[ExamOut]}
  POST /api/exams            → 201 ExamOut   (teacher/admin only; 403 for student)
  GET  /api/exams/{exam_id}  → 200 ExamOut | 404
  PUT  /api/exams/{exam_id}  → 200 ExamOut   (teacher/admin only)

RED phase: routes are not registered yet (T020), so every call hits 404 and
these tests fail. They turn green once the exam router is implemented.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")

_EXAMS_URL = "/api/exams"


async def _register(client: AsyncClient, email: str, role: str = "student") -> str:
    r = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "name": email.split("@")[0],
            "password": "SecurePass1!",
            "role": role,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_exam(
    client: AsyncClient, token: str, *, title: str = "JEE Main 2026", exam_type: str = "JEE"
) -> dict:
    r = await client.post(
        _EXAMS_URL,
        headers=_auth(token),
        json={"title": title, "exam_type": exam_type, "description": "Mock series"},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ─── List ───────────────────────────────────────────────
async def test_list_exams_requires_auth(client: AsyncClient):
    r = await client.get(_EXAMS_URL)
    assert r.status_code == 401


async def test_list_exams_returns_paginated_shape(client: AsyncClient):
    token = await _register(client, "list_student@example.com")
    r = await client.get(_EXAMS_URL, headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert {"total", "page", "limit", "items"} <= body.keys()
    assert isinstance(body["items"], list)


# ─── Create ─────────────────────────────────────────────
async def test_create_exam_as_teacher_returns_201(client: AsyncClient):
    token = await _register(client, "create_teacher@example.com", role="teacher")
    r = await client.post(
        _EXAMS_URL,
        headers=_auth(token),
        json={"title": "NEET 2026", "exam_type": "NEET"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "NEET 2026"
    assert body["exam_type"] == "NEET"
    assert body["is_published"] is False  # default per contract
    assert "id" in body and "created_by" in body and "created_at" in body


async def test_create_exam_as_student_returns_403(client: AsyncClient):
    token = await _register(client, "create_student@example.com")
    r = await client.post(
        _EXAMS_URL,
        headers=_auth(token),
        json={"title": "Sneaky", "exam_type": "JEE"},
    )
    assert r.status_code == 403


async def test_create_exam_requires_auth(client: AsyncClient):
    r = await client.post(_EXAMS_URL, json={"title": "Anon", "exam_type": "JEE"})
    assert r.status_code == 401


async def test_create_exam_missing_required_field_returns_422(client: AsyncClient):
    token = await _register(client, "create_teacher2@example.com", role="teacher")
    r = await client.post(_EXAMS_URL, headers=_auth(token), json={"title": "No type"})
    assert r.status_code == 422


# ─── Retrieve ───────────────────────────────────────────
async def test_get_exam_by_id_returns_200(client: AsyncClient):
    token = await _register(client, "get_teacher@example.com", role="teacher")
    created = await _create_exam(client, token, title="GATE 2026", exam_type="GATE")
    r = await client.get(f"{_EXAMS_URL}/{created['id']}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


async def test_get_nonexistent_exam_returns_404(client: AsyncClient):
    token = await _register(client, "get_404@example.com")
    r = await client.get(f"{_EXAMS_URL}/{uuid4()}", headers=_auth(token))
    assert r.status_code == 404


# ─── Update ─────────────────────────────────────────────
async def test_update_exam_as_teacher_returns_200(client: AsyncClient):
    token = await _register(client, "put_teacher@example.com", role="teacher")
    created = await _create_exam(client, token, title="UPSC Prelims", exam_type="UPSC")
    r = await client.put(
        f"{_EXAMS_URL}/{created['id']}",
        headers=_auth(token),
        json={"title": "UPSC Prelims 2026", "is_published": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "UPSC Prelims 2026"
    assert body["is_published"] is True


async def test_update_exam_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "put_owner@example.com", role="teacher")
    created = await _create_exam(client, teacher, title="Editable", exam_type="JEE")
    student = await _register(client, "put_student@example.com")
    r = await client.put(
        f"{_EXAMS_URL}/{created['id']}",
        headers=_auth(student),
        json={"title": "Hacked"},
    )
    assert r.status_code == 403


# ─── Filtering ──────────────────────────────────────────
async def test_filter_exams_by_type(client: AsyncClient):
    token = await _register(client, "filter_teacher@example.com", role="teacher")
    await _create_exam(client, token, title="JEE A", exam_type="JEE")
    await _create_exam(client, token, title="NEET A", exam_type="NEET")
    r = await client.get(_EXAMS_URL, headers=_auth(token), params={"exam_type": "JEE"})
    assert r.status_code == 200
    types = {e["exam_type"] for e in r.json()["items"]}
    assert types <= {"JEE"}
