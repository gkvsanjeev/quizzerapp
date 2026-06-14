from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

Difficulty = Literal["easy", "medium", "hard"]
OptionKey = Literal["A", "B", "C", "D"]


# ─── Student-facing question/option (answer key never revealed) ──────────
class OptionStudentOut(BaseModel):
    """Option as shown during an exam — deliberately omits `is_correct`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    option_key: OptionKey
    text: str
    image_url: str | None = None


class QuestionStudentOut(BaseModel):
    id: UUID
    text: str
    image_url: str | None = None
    difficulty: Difficulty
    subject: str  # subject name
    topic: str | None = None  # topic name
    options: list[OptionStudentOut] = []


# ─── Start ──────────────────────────────────────────────
class AttemptCreate(BaseModel):
    test_paper_id: UUID


class TestPaperBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    duration_seconds: int
    total_marks: Decimal


class AnswerStateOut(BaseModel):
    selected_option_id: UUID | None = None
    is_marked_for_review: bool = False
    visit_count: int = 0


class AttemptStateOut(BaseModel):
    """Full exam state returned on start or resume."""

    attempt_id: UUID
    test_paper: TestPaperBrief
    questions: list[QuestionStudentOut]
    answers: dict[str, AnswerStateOut]  # question_id (str) → state
    started_at: datetime
    time_elapsed_seconds: int


# ─── Auto-save ──────────────────────────────────────────
class AnswerUpdate(BaseModel):
    question_id: UUID
    selected_option_id: UUID | None = None
    time_spent_delta_seconds: int = 0
    is_marked_for_review: bool | None = None


# ─── Submit / result ────────────────────────────────────
class AttemptResultOut(BaseModel):
    attempt_id: UUID
    raw_score: Decimal
    final_score: Decimal
    rank: int | None = None
    percentile: Decimal | None = None
    total_questions: int
    attempted: int
    correct: int
    incorrect: int


# ─── List / history ─────────────────────────────────────
class AttemptSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    test_paper_id: UUID
    status: str
    started_at: datetime
    submitted_at: datetime | None = None
    final_score: Decimal | None = None
    rank: int | None = None
    percentile: Decimal | None = None
