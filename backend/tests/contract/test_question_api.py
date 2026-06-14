"""Contract tests for the question routes (T022).

Validated against docs/specifications/contracts/api-spec.yaml and
docs/specifications/api-endpoints.md:
  GET    /api/questions                → 200 Paginated{total,page,limit,items:[QuestionOut]}
  POST   /api/questions                → 201 QuestionOut   (teacher/admin only; 403 student)
  PUT    /api/questions/{question_id}  → 200 QuestionOut   (teacher/admin only) | 404
  DELETE /api/questions/{question_id}  → 204               (teacher/admin only) | 404

RED phase: the question router is not implemented/registered yet (T023), so
these calls hit 404 and the tests fail. They turn green once the routes exist.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")

_QUESTIONS_URL = "/api/questions"


async def _register(client: AsyncClient, email: str, role: str = "student") -> str:
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "name": email.split("@")[0], "password": "SecurePass1!", "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_subject(client: AsyncClient, token: str, *, name: str = "Physics") -> str:
    """A question needs a subject; subjects hang off an exam (T020/T021)."""
    r = await client.post(
        "/api/exams", headers=_auth(token), json={"title": "Exam", "exam_type": "JEE"}
    )
    assert r.status_code == 201, r.text
    exam_id = r.json()["id"]
    r = await client.post(
        f"/api/exams/{exam_id}/subjects", headers=_auth(token), json={"name": name}
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _question_payload(subject_id: str, **overrides) -> dict:
    payload = {
        "subject_id": subject_id,
        "text": "What is 2 + 2?",
        "difficulty": "easy",
        "tags": ["arithmetic"],
        "options": [
            {"option_key": "A", "text": "3", "is_correct": False},
            {"option_key": "B", "text": "4", "is_correct": True},
            {"option_key": "C", "text": "5", "is_correct": False},
            {"option_key": "D", "text": "22", "is_correct": False},
        ],
    }
    payload.update(overrides)
    return payload


async def _create_question(client: AsyncClient, token: str, subject_id: str, **overrides) -> dict:
    r = await client.post(
        _QUESTIONS_URL, headers=_auth(token), json=_question_payload(subject_id, **overrides)
    )
    assert r.status_code == 201, r.text
    return r.json()


# ─── List ───────────────────────────────────────────────
async def test_list_questions_requires_auth(client: AsyncClient):
    r = await client.get(_QUESTIONS_URL)
    assert r.status_code == 401


async def test_list_questions_returns_paginated_shape(client: AsyncClient):
    token = await _register(client, "q_list@example.com")
    r = await client.get(_QUESTIONS_URL, headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert {"total", "page", "limit", "items"} <= body.keys()
    assert isinstance(body["items"], list)


# ─── Create ─────────────────────────────────────────────
async def test_create_question_as_teacher_returns_201(client: AsyncClient):
    teacher = await _register(client, "q_create_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    r = await client.post(
        _QUESTIONS_URL, headers=_auth(teacher), json=_question_payload(subject_id)
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["text"] == "What is 2 + 2?"
    assert body["difficulty"] == "easy"
    assert body["subject_id"] == subject_id
    assert {"id", "created_at", "options"} <= body.keys()
    assert len(body["options"]) == 4


async def test_create_question_never_reveals_is_correct(client: AsyncClient):
    """OptionOut must omit is_correct — the answer key is never sent to clients."""
    teacher = await _register(client, "q_secret_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    body = await _create_question(client, teacher, subject_id)
    for opt in body["options"]:
        assert "is_correct" not in opt


async def test_create_question_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "q_owner_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    student = await _register(client, "q_student@example.com")
    r = await client.post(
        _QUESTIONS_URL, headers=_auth(student), json=_question_payload(subject_id)
    )
    assert r.status_code == 403


async def test_create_question_requires_auth(client: AsyncClient):
    r = await client.post(_QUESTIONS_URL, json=_question_payload(str(uuid4())))
    assert r.status_code == 401


async def test_create_question_missing_text_returns_422(client: AsyncClient):
    teacher = await _register(client, "q_422_text_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    payload = _question_payload(subject_id)
    del payload["text"]
    r = await client.post(_QUESTIONS_URL, headers=_auth(teacher), json=payload)
    assert r.status_code == 422


async def test_create_question_requires_exactly_four_options(client: AsyncClient):
    teacher = await _register(client, "q_422_opts_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    payload = _question_payload(subject_id)
    payload["options"] = payload["options"][:3]  # only 3 options
    r = await client.post(_QUESTIONS_URL, headers=_auth(teacher), json=payload)
    assert r.status_code == 422


# ─── Filtering ──────────────────────────────────────────
async def test_filter_questions_by_subject(client: AsyncClient):
    teacher = await _register(client, "q_filter_subj_t@example.com", role="teacher")
    physics = await _create_subject(client, teacher, name="Physics")
    chemistry = await _create_subject(client, teacher, name="Chemistry")
    await _create_question(client, teacher, physics)
    await _create_question(client, teacher, chemistry)
    r = await client.get(_QUESTIONS_URL, headers=_auth(teacher), params={"subject_id": physics})
    assert r.status_code == 200
    subjects = {q["subject_id"] for q in r.json()["items"]}
    assert subjects <= {physics}


async def test_filter_questions_by_difficulty(client: AsyncClient):
    teacher = await _register(client, "q_filter_diff_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    await _create_question(client, teacher, subject_id, difficulty="easy")
    await _create_question(client, teacher, subject_id, difficulty="hard")
    r = await client.get(_QUESTIONS_URL, headers=_auth(teacher), params={"difficulty": "hard"})
    assert r.status_code == 200
    difficulties = {q["difficulty"] for q in r.json()["items"]}
    assert difficulties <= {"hard"}


# ─── Update ─────────────────────────────────────────────
async def test_update_question_as_teacher_returns_200(client: AsyncClient):
    teacher = await _register(client, "q_put_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    created = await _create_question(client, teacher, subject_id)
    r = await client.put(
        f"{_QUESTIONS_URL}/{created['id']}",
        headers=_auth(teacher),
        json={"text": "What is 3 + 1?", "difficulty": "medium"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "What is 3 + 1?"
    assert body["difficulty"] == "medium"


async def test_update_question_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "q_put_owner_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    created = await _create_question(client, teacher, subject_id)
    student = await _register(client, "q_put_student@example.com")
    r = await client.put(
        f"{_QUESTIONS_URL}/{created['id']}",
        headers=_auth(student),
        json={"text": "Hacked"},
    )
    assert r.status_code == 403


async def test_update_nonexistent_question_returns_404(client: AsyncClient):
    teacher = await _register(client, "q_put_404_t@example.com", role="teacher")
    r = await client.put(
        f"{_QUESTIONS_URL}/{uuid4()}", headers=_auth(teacher), json={"text": "Ghost"}
    )
    assert r.status_code == 404


# ─── Delete ─────────────────────────────────────────────
async def test_delete_question_as_teacher_returns_204(client: AsyncClient):
    teacher = await _register(client, "q_del_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    created = await _create_question(client, teacher, subject_id)
    r = await client.delete(f"{_QUESTIONS_URL}/{created['id']}", headers=_auth(teacher))
    assert r.status_code == 204


async def test_delete_question_as_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "q_del_owner_t@example.com", role="teacher")
    subject_id = await _create_subject(client, teacher)
    created = await _create_question(client, teacher, subject_id)
    student = await _register(client, "q_del_student@example.com")
    r = await client.delete(f"{_QUESTIONS_URL}/{created['id']}", headers=_auth(student))
    assert r.status_code == 403


async def test_delete_nonexistent_question_returns_404(client: AsyncClient):
    teacher = await _register(client, "q_del_404_t@example.com", role="teacher")
    r = await client.delete(f"{_QUESTIONS_URL}/{uuid4()}", headers=_auth(teacher))
    assert r.status_code == 404
