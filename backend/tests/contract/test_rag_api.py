"""Contract tests for RAG routes (T055).

Tests for:
  POST   /api/rag/upload             → 202 + 401 + 403
  GET    /api/rag/documents          → 200 list
  GET    /api/rag/documents/{id}     → 200 | 404
  POST   /api/rag/generate-questions → 200
  POST   /api/rag/questions/save     → 200
  GET    /api/rag/search             → 200

RED phase: rag router not registered yet → 404 on most endpoints.
GREEN phase: routes exist in T056+.
"""

import io
from uuid import uuid4

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")

_RAG_URL = "/api/rag"


async def _register(client: AsyncClient, email: str, role: str = "student") -> str:
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "name": email.split("@")[0], "password": "SecurePass1!", "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─── Upload ──────────────────────────────────────────────
async def test_upload_requires_auth(client: AsyncClient):
    r = await client.post(f"{_RAG_URL}/upload")
    assert r.status_code == 401


async def test_upload_as_student_returns_403(client: AsyncClient):
    student = await _register(client, "rag_stu@example.com")
    r = await client.post(
        f"{_RAG_URL}/upload",
        headers=_auth(student),
        files={"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 mock pdf content"), "application/pdf")},
    )
    assert r.status_code == 403


async def test_upload_as_teacher_returns_202(client: AsyncClient):
    teacher = await _register(client, "rag_t@example.com", role="teacher")
    r = await client.post(
        f"{_RAG_URL}/upload",
        headers=_auth(teacher),
        files={"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 mock pdf content"), "application/pdf")},
    )
    assert r.status_code == 202, r.text
    body = r.json()
    assert "document_id" in body
    assert body["status"] == "pending"


# ─── List documents ──────────────────────────────────────
async def test_list_documents_requires_auth(client: AsyncClient):
    r = await client.get(f"{_RAG_URL}/documents")
    assert r.status_code == 401


async def test_list_documents_returns_list(client: AsyncClient):
    teacher = await _register(client, "rag_list_t@example.com", role="teacher")
    r = await client.get(f"{_RAG_URL}/documents", headers=_auth(teacher))
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)


# ─── Get single document ─────────────────────────────────
async def test_get_document_returns_404_for_nonexistent(client: AsyncClient):
    teacher = await _register(client, "rag_404_t@example.com", role="teacher")
    r = await client.get(f"{_RAG_URL}/documents/{uuid4()}", headers=_auth(teacher))
    assert r.status_code == 404


# ─── Generate questions ──────────────────────────────────
async def test_generate_questions_requires_auth(client: AsyncClient):
    r = await client.post(f"{_RAG_URL}/generate-questions")
    assert r.status_code == 401


async def test_generate_questions_as_student_returns_403(client: AsyncClient):
    student = await _register(client, "rag_gen_s@example.com")
    r = await client.post(
        f"{_RAG_URL}/generate-questions",
        headers=_auth(student),
        json={
            "document_id": str(uuid4()),
            "subject_id": str(uuid4()),
            "count": 5,
            "difficulty": "medium",
        },
    )
    assert r.status_code == 403


async def test_generate_questions_as_teacher_returns_200(client: AsyncClient):
    teacher = await _register(client, "rag_gen_t@example.com", role="teacher")
    r = await client.post(
        f"{_RAG_URL}/generate-questions",
        headers=_auth(teacher),
        json={
            "document_id": str(uuid4()),
            "subject_id": str(uuid4()),
            "count": 5,
            "difficulty": "medium",
        },
    )
    assert r.status_code == 200


# ─── Save questions ──────────────────────────────────────
async def test_save_questions_requires_auth(client: AsyncClient):
    r = await client.post(f"{_RAG_URL}/questions/save")
    assert r.status_code == 401


async def test_save_questions_as_student_returns_403(client: AsyncClient):
    student = await _register(client, "rag_save_s@example.com")
    r = await client.post(
        f"{_RAG_URL}/questions/save",
        headers=_auth(student),
        json={
            "subject_id": str(uuid4()),
            "questions": [
                {
                    "text": "What is 2+2?",
                    "explanation": "Basic math.",
                    "options": [
                        {"option_key": "A", "text": "3", "is_correct": False},
                        {"option_key": "B", "text": "4", "is_correct": True},
                        {"option_key": "C", "text": "5", "is_correct": False},
                        {"option_key": "D", "text": "6", "is_correct": False},
                    ],
                }
            ],
        },
    )
    assert r.status_code == 403


async def test_save_questions_as_teacher_returns_200(client: AsyncClient):
    teacher = await _register(client, "rag_save_t@example.com", role="teacher")
    r = await client.post(
        f"{_RAG_URL}/questions/save",
        headers=_auth(teacher),
        json={
            "subject_id": str(uuid4()),
            "questions": [
                {
                    "text": "What is 2+2?",
                    "explanation": "Basic math.",
                    "options": [
                        {"option_key": "A", "text": "3", "is_correct": False},
                        {"option_key": "B", "text": "4", "is_correct": True},
                        {"option_key": "C", "text": "5", "is_correct": False},
                        {"option_key": "D", "text": "6", "is_correct": False},
                    ],
                }
            ],
        },
    )
    assert r.status_code == 200


# ─── Search ──────────────────────────────────────────────
async def test_search_requires_auth(client: AsyncClient):
    r = await client.get(f"{_RAG_URL}/search")
    assert r.status_code == 401


async def test_search_returns_200(client: AsyncClient):
    teacher = await _register(client, "rag_search_t@example.com", role="teacher")
    r = await client.get(
        f"{_RAG_URL}/search",
        headers=_auth(teacher),
        params={"query": "test query"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "chunks" in body
    assert isinstance(body["chunks"], list)
