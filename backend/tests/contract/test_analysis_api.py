"""Contract tests for the analysis routes (T042).

GET /api/analysis/{attempt_id}/<section> for the 9 sections, per
docs/specifications/api-endpoints.md. Auth: attempt owner, the paper-creating
teacher, or admin.

RED phase: the analysis router is not implemented yet (T043/T044) → 404 → these
fail until the routes exist.

Fixture data (one submitted attempt):
  Q1 easy   — answered correctly (key B)   → correct,    +4
  Q2 medium — answered incorrectly (key A)  → incorrect,  -1
  Q3 hard   — unanswered                    → unattempted
  raw_score = 4, final_score = 3, accuracy = 50%
"""

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


async def _create_question(client: AsyncClient, token: str, subject_id: str, text: str, difficulty: str) -> str:
    r = await client.post(
        "/api/questions",
        headers=_auth(token),
        json={
            "subject_id": subject_id,
            "text": text,
            "difficulty": difficulty,
            "explanation": "Because.",
            "options": [
                {"option_key": "A", "text": "wrong", "is_correct": False},
                {"option_key": "B", "text": "right", "is_correct": True},
                {"option_key": "C", "text": "wrong", "is_correct": False},
                {"option_key": "D", "text": "wrong", "is_correct": False},
            ],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _option_id(state: dict, question_id: str, key: str) -> str:
    for q in state["questions"]:
        if q["id"] == question_id:
            for opt in q["options"]:
                if opt["option_key"] == key:
                    return opt["id"]
    raise AssertionError(f"option {key} not found for {question_id}")


async def _setup_submitted(client: AsyncClient, prefix: str) -> dict:
    teacher = await _register(client, f"{prefix}_t@example.com", role="teacher")
    exam = (
        await client.post("/api/exams", headers=_auth(teacher), json={"title": "E", "exam_type": "JEE"})
    ).json()
    await client.put(f"/api/exams/{exam['id']}", headers=_auth(teacher), json={"is_published": True})
    subject = (
        await client.post(f"/api/exams/{exam['id']}/subjects", headers=_auth(teacher), json={"name": "Physics"})
    ).json()
    q1 = await _create_question(client, teacher, subject["id"], "Q1", "easy")
    q2 = await _create_question(client, teacher, subject["id"], "Q2", "medium")
    q3 = await _create_question(client, teacher, subject["id"], "Q3", "hard")
    paper = (
        await client.post(
            f"/api/exams/{exam['id']}/test-papers",
            headers=_auth(teacher),
            json={"title": "Paper", "duration_seconds": 3600, "total_marks": 12},
        )
    ).json()
    await client.post(
        f"/api/test-papers/{paper['id']}/questions",
        headers=_auth(teacher),
        json={
            "question_ids": [
                {"question_id": q1, "display_order": 1, "marks": 4, "negative_marks": 1},
                {"question_id": q2, "display_order": 2, "marks": 4, "negative_marks": 1},
                {"question_id": q3, "display_order": 3, "marks": 4, "negative_marks": 1},
            ]
        },
    )

    student = await _register(client, f"{prefix}_s@example.com")
    state = (
        await client.post("/api/attempts", headers=_auth(student), json={"test_paper_id": paper["id"]})
    ).json()
    attempt_id = state["attempt_id"]
    # Q1 correct (B), Q2 incorrect (A), Q3 left blank.
    await client.put(
        f"/api/attempts/{attempt_id}/answer",
        headers=_auth(student),
        json={"question_id": q1, "selected_option_id": _option_id(state, q1, "B"), "time_spent_delta_seconds": 30},
    )
    await client.put(
        f"/api/attempts/{attempt_id}/answer",
        headers=_auth(student),
        json={"question_id": q2, "selected_option_id": _option_id(state, q2, "A"), "time_spent_delta_seconds": 60, "is_marked_for_review": True},
    )
    await client.post(f"/api/attempts/{attempt_id}/submit", headers=_auth(student))

    return {
        "attempt_id": attempt_id,
        "student": student,
        "teacher": teacher,
        "q1": q1,
        "q2": q2,
        "q3": q3,
    }


def _url(attempt_id: str, section: str) -> str:
    return f"/api/analysis/{attempt_id}/{section}"


# ─── Auth / ownership ───────────────────────────────────
async def test_overview_requires_auth(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_auth")
    r = await client.get(_url(ctx["attempt_id"], "overview"))
    assert r.status_code == 401


async def test_overview_as_other_student_returns_403(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_403")
    intruder = await _register(client, "an_403_intruder@example.com")
    r = await client.get(_url(ctx["attempt_id"], "overview"), headers=_auth(intruder))
    assert r.status_code == 403


async def test_overview_as_paper_teacher_returns_200(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_teacher")
    r = await client.get(_url(ctx["attempt_id"], "overview"), headers=_auth(ctx["teacher"]))
    assert r.status_code == 200


async def test_overview_nonexistent_attempt_returns_404(client: AsyncClient):
    token = await _register(client, "an_404@example.com")
    r = await client.get(_url("00000000-0000-0000-0000-000000000000", "overview"), headers=_auth(token))
    assert r.status_code == 404


# ─── The 9 sections ─────────────────────────────────────
async def test_overview_numbers(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_overview")
    r = await client.get(_url(ctx["attempt_id"], "overview"), headers=_auth(ctx["student"]))
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["total_questions"] == 3
    assert b["correct"] == 1
    assert b["incorrect"] == 1
    assert b["unattempted"] == 1
    assert b["attempted"] == 2
    assert b["score"] == 3  # final
    assert b["accuracy_percentage"] == 50.0
    assert b["duration_seconds"] == 3600


async def test_performance_subjects(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_perf")
    r = await client.get(_url(ctx["attempt_id"], "performance"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    subjects = r.json()["subjects"]
    assert any(s["name"] == "Physics" for s in subjects)


async def test_time_section(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_time")
    r = await client.get(_url(ctx["attempt_id"], "time"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    b = r.json()
    assert {"total_time_seconds", "avg_time_per_question_seconds", "subjects", "difficulty", "questions"} <= b.keys()
    assert b["total_time_seconds"] >= 90  # 30 + 60


async def test_attempts_breakdown(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_breakdown")
    r = await client.get(_url(ctx["attempt_id"], "attempts"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    b = r.json()
    assert b["correct"] == 1
    assert b["incorrect"] == 1
    assert b["marked_for_review"] == 1
    assert b["gross_score"] == 4
    assert b["negative_marks"] == 1
    assert b["net_score"] == 3


async def test_difficulty_breakdown(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_diff")
    r = await client.get(_url(ctx["attempt_id"], "difficulty"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    b = r.json()
    assert b["easy"]["total"] == 1 and b["easy"]["correct"] == 1
    assert b["medium"]["total"] == 1 and b["medium"]["incorrect"] == 1
    assert b["hard"]["total"] == 1 and b["hard"]["unattempted"] == 1


async def test_subject_movement(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_move")
    r = await client.get(_url(ctx["attempt_id"], "subject-movement"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    b = r.json()
    assert "transitions" in b and "time_in_subject" in b


async def test_question_journey(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_journey")
    r = await client.get(_url(ctx["attempt_id"], "question-journey"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    events = r.json()["events"]
    assert isinstance(events, list)
    assert any(e["event"] == "answered" for e in events)


async def test_question_detail(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_qdetail")
    r = await client.get(_url(ctx["attempt_id"], f"question/{ctx['q1']}"), headers=_auth(ctx["student"]))
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["question_id"] == ctx["q1"]
    assert b["correct_answer"] == "B"
    assert b["your_answer"] == "B"
    assert b["is_correct"] is True
    # detail DOES reveal the answer key (post-submission review)
    assert any(o["is_correct"] for o in b["options"])
    assert any(o["selected"] for o in b["options"])


async def test_question_list(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_qlist")
    r = await client.get(_url(ctx["attempt_id"], "questions"), headers=_auth(ctx["student"]))
    assert r.status_code == 200
    questions = r.json()["questions"]
    assert len(questions) == 3
    by_id = {q["question_id"]: q for q in questions}
    assert by_id[ctx["q1"]]["result"] == "correct"
    assert by_id[ctx["q2"]]["result"] == "incorrect"
    assert by_id[ctx["q3"]]["result"] == "unattempted"


async def test_question_list_filter_by_result(client: AsyncClient):
    ctx = await _setup_submitted(client, "an_qfilter")
    r = await client.get(
        _url(ctx["attempt_id"], "questions"),
        headers=_auth(ctx["student"]),
        params={"result": "correct"},
    )
    assert r.status_code == 200
    results = {q["result"] for q in r.json()["questions"]}
    assert results <= {"correct"}
