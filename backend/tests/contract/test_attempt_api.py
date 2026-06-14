"""Contract tests for the attempt routes (T031).

Per docs/specifications/api-endpoints.md + api-spec.yaml:
  POST /api/attempts                  → 201 AttemptStateOut (student) | 401 | 403 | 409
  GET  /api/attempts/{id}             → 200 AttemptStateOut (owner/admin) | 403 | 404
  PUT  /api/attempts/{id}/answer      → 200 { saved: true } (owner) | 403
  POST /api/attempts/{id}/submit      → 200 AttemptResultOut (owner) | 400 (already submitted)
  GET  /api/attempts                  → 200 AttemptSummaryOut[]

RED phase: the attempts router is not implemented yet (T032–T034), so these calls
hit 404 and the tests fail. They turn green once the routes exist.

A question's correct option is option_key "B" in every helper-created question, so
selecting the option whose key is "B" is the "correct" answer for scoring assertions.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")

_ATTEMPTS_URL = "/api/attempts"


async def _register(client: AsyncClient, email: str, role: str = "student") -> str:
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "name": email.split("@")[0], "password": "SecurePass1!", "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_question(client: AsyncClient, token: str, subject_id: str, text: str) -> str:
    """Creates a 4-option question with option_key 'B' as the correct answer."""
    r = await client.post(
        "/api/questions",
        headers=_auth(token),
        json={
            "subject_id": subject_id,
            "text": text,
            "difficulty": "easy",
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


async def _setup_paper(client: AsyncClient, teacher: str, *, publish: bool = True) -> dict:
    """Create a published exam with a subject, two questions, and a test paper
    containing both. Returns ids needed by the attempt tests."""
    r = await client.post(
        "/api/exams", headers=_auth(teacher), json={"title": "Exam", "exam_type": "JEE"}
    )
    assert r.status_code == 201, r.text
    exam_id = r.json()["id"]

    if publish:
        r = await client.put(
            f"/api/exams/{exam_id}", headers=_auth(teacher), json={"is_published": True}
        )
        assert r.status_code == 200, r.text

    r = await client.post(
        f"/api/exams/{exam_id}/subjects", headers=_auth(teacher), json={"name": "Physics"}
    )
    assert r.status_code == 201, r.text
    subject_id = r.json()["id"]

    q1 = await _create_question(client, teacher, subject_id, "Q1?")
    q2 = await _create_question(client, teacher, subject_id, "Q2?")

    r = await client.post(
        f"/api/exams/{exam_id}/test-papers",
        headers=_auth(teacher),
        json={"title": "Mock", "duration_seconds": 3600, "total_marks": 8},
    )
    assert r.status_code == 201, r.text
    paper_id = r.json()["id"]

    r = await client.post(
        f"/api/test-papers/{paper_id}/questions",
        headers=_auth(teacher),
        json={
            "question_ids": [
                {"question_id": q1, "display_order": 1, "marks": 4, "negative_marks": 1},
                {"question_id": q2, "display_order": 2, "marks": 4, "negative_marks": 1},
            ]
        },
    )
    assert r.status_code == 200, r.text
    return {"exam_id": exam_id, "subject_id": subject_id, "paper_id": paper_id, "q1": q1, "q2": q2}


def _correct_option_id(state: dict, question_id: str) -> str:
    """From an AttemptStateOut, return the id of the option keyed 'B' (the correct one)."""
    for q in state["questions"]:
        if q["id"] == question_id:
            for opt in q["options"]:
                if opt["option_key"] == "B":
                    return opt["id"]
    raise AssertionError("correct option not found in attempt state")


# ─── Start ──────────────────────────────────────────────
async def test_start_attempt_requires_auth(client: AsyncClient):
    r = await client.post(_ATTEMPTS_URL, json={"test_paper_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 401


async def test_start_attempt_as_student_returns_201_with_state(client: AsyncClient):
    teacher = await _register(client, "att_start_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_start_s@example.com")

    r = await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert {"attempt_id", "test_paper", "questions", "answers", "started_at", "time_elapsed_seconds"} <= body.keys()
    assert body["test_paper"]["id"] == setup["paper_id"]
    assert len(body["questions"]) == 2
    assert body["answers"] == {}
    # Freshly started — a few seconds of slack for DB round-trips under load.
    assert 0 <= body["time_elapsed_seconds"] < 5
    # answer key must never be revealed
    for q in body["questions"]:
        assert q["subject"] == "Physics"
        for opt in q["options"]:
            assert "is_correct" not in opt


async def test_start_attempt_as_teacher_returns_403(client: AsyncClient):
    teacher = await _register(client, "att_role_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    r = await client.post(_ATTEMPTS_URL, headers=_auth(teacher), json={"test_paper_id": setup["paper_id"]})
    assert r.status_code == 403


async def test_start_attempt_on_unpublished_exam_returns_403(client: AsyncClient):
    teacher = await _register(client, "att_unpub_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher, publish=False)
    student = await _register(client, "att_unpub_s@example.com")
    r = await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})
    assert r.status_code == 403


async def test_start_attempt_twice_returns_409(client: AsyncClient):
    teacher = await _register(client, "att_dup_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_dup_s@example.com")
    r1 = await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})
    assert r1.status_code == 201
    r2 = await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})
    assert r2.status_code == 409


# ─── Resume ─────────────────────────────────────────────
async def test_resume_attempt_returns_200(client: AsyncClient):
    teacher = await _register(client, "att_resume_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_resume_s@example.com")
    started = (await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})).json()
    attempt_id = started["attempt_id"]

    r = await client.get(f"{_ATTEMPTS_URL}/{attempt_id}", headers=_auth(student))
    assert r.status_code == 200
    assert r.json()["attempt_id"] == attempt_id


async def test_resume_attempt_as_other_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "att_owner_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    owner = await _register(client, "att_owner_s@example.com")
    intruder = await _register(client, "att_intruder_s@example.com")
    started = (await client.post(_ATTEMPTS_URL, headers=_auth(owner), json={"test_paper_id": setup["paper_id"]})).json()

    r = await client.get(f"{_ATTEMPTS_URL}/{started['attempt_id']}", headers=_auth(intruder))
    assert r.status_code == 403


async def test_resume_nonexistent_attempt_returns_404(client: AsyncClient):
    student = await _register(client, "att_404_s@example.com")
    r = await client.get(f"{_ATTEMPTS_URL}/00000000-0000-0000-0000-000000000000", headers=_auth(student))
    assert r.status_code == 404


# ─── Auto-save ──────────────────────────────────────────
async def test_save_answer_returns_saved_and_persists(client: AsyncClient):
    teacher = await _register(client, "att_save_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_save_s@example.com")
    state = (await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})).json()
    attempt_id = state["attempt_id"]
    option_id = _correct_option_id(state, setup["q1"])

    r = await client.put(
        f"{_ATTEMPTS_URL}/{attempt_id}/answer",
        headers=_auth(student),
        json={
            "question_id": setup["q1"],
            "selected_option_id": option_id,
            "time_spent_delta_seconds": 30,
            "is_marked_for_review": True,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"saved": True}

    # The saved answer appears on resume.
    resumed = (await client.get(f"{_ATTEMPTS_URL}/{attempt_id}", headers=_auth(student))).json()
    saved = resumed["answers"][setup["q1"]]
    assert saved["selected_option_id"] == option_id
    assert saved["is_marked_for_review"] is True


async def test_save_answer_as_other_student_returns_403(client: AsyncClient):
    teacher = await _register(client, "att_save403_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    owner = await _register(client, "att_save403_o@example.com")
    intruder = await _register(client, "att_save403_i@example.com")
    state = (await client.post(_ATTEMPTS_URL, headers=_auth(owner), json={"test_paper_id": setup["paper_id"]})).json()

    r = await client.put(
        f"{_ATTEMPTS_URL}/{state['attempt_id']}/answer",
        headers=_auth(intruder),
        json={"question_id": setup["q1"], "selected_option_id": None, "time_spent_delta_seconds": 5},
    )
    assert r.status_code == 403


# ─── Submit ─────────────────────────────────────────────
async def test_submit_scores_correctly(client: AsyncClient):
    teacher = await _register(client, "att_submit_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_submit_s@example.com")
    state = (await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})).json()
    attempt_id = state["attempt_id"]

    # Answer Q1 correctly (key B), leave Q2 unanswered.
    await client.put(
        f"{_ATTEMPTS_URL}/{attempt_id}/answer",
        headers=_auth(student),
        json={"question_id": setup["q1"], "selected_option_id": _correct_option_id(state, setup["q1"])},
    )

    r = await client.post(f"{_ATTEMPTS_URL}/{attempt_id}/submit", headers=_auth(student))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["attempt_id"] == attempt_id
    assert body["total_questions"] == 2
    assert body["correct"] == 1
    assert body["incorrect"] == 0
    assert body["attempted"] == 1
    assert float(body["raw_score"]) == 4
    assert float(body["final_score"]) == 4


async def test_submit_applies_negative_marking(client: AsyncClient):
    teacher = await _register(client, "att_neg_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_neg_s@example.com")
    state = (await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})).json()
    attempt_id = state["attempt_id"]

    # Answer Q1 wrong (pick key A), leave Q2 blank → -1 negative mark.
    wrong_id = next(o["id"] for q in state["questions"] if q["id"] == setup["q1"] for o in q["options"] if o["option_key"] == "A")
    await client.put(
        f"{_ATTEMPTS_URL}/{attempt_id}/answer",
        headers=_auth(student),
        json={"question_id": setup["q1"], "selected_option_id": wrong_id},
    )

    body = (await client.post(f"{_ATTEMPTS_URL}/{attempt_id}/submit", headers=_auth(student))).json()
    assert body["correct"] == 0
    assert body["incorrect"] == 1
    assert float(body["raw_score"]) == 0
    assert float(body["final_score"]) == -1


async def test_submit_twice_returns_400(client: AsyncClient):
    teacher = await _register(client, "att_resubmit_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_resubmit_s@example.com")
    state = (await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})).json()
    attempt_id = state["attempt_id"]
    await client.post(f"{_ATTEMPTS_URL}/{attempt_id}/submit", headers=_auth(student))
    r = await client.post(f"{_ATTEMPTS_URL}/{attempt_id}/submit", headers=_auth(student))
    assert r.status_code == 400


# ─── List ───────────────────────────────────────────────
async def test_list_attempts_returns_own_attempts(client: AsyncClient):
    teacher = await _register(client, "att_list_t@example.com", role="teacher")
    setup = await _setup_paper(client, teacher)
    student = await _register(client, "att_list_s@example.com")
    started = (await client.post(_ATTEMPTS_URL, headers=_auth(student), json={"test_paper_id": setup["paper_id"]})).json()

    r = await client.get(_ATTEMPTS_URL, headers=_auth(student))
    assert r.status_code == 200
    ids = {a["id"] for a in r.json()}
    assert started["attempt_id"] in ids
