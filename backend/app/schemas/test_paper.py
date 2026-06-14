from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Test Paper ─────────────────────────────────────────
class TestPaperCreate(BaseModel):
    # exam_id comes from the path (/api/exams/{exam_id}/test-papers), not the body.
    title: str
    duration_seconds: int = Field(gt=0)
    total_marks: Decimal
    scheduled_at: datetime | None = None
    negative_marking_factor: Decimal = Decimal("0.25")
    shuffle_questions: bool = False
    shuffle_options: bool = False


class TestPaperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exam_id: UUID
    title: str
    scheduled_at: datetime | None = None
    duration_seconds: int
    total_marks: float
    negative_marking_factor: float
    shuffle_questions: bool
    shuffle_options: bool
    created_at: datetime


# ─── Test Paper Questions ───────────────────────────────
class TestPaperQuestionAdd(BaseModel):
    """One entry in the bulk add-questions payload:
    POST /api/test-papers/{id}/questions → { question_ids: [TestPaperQuestionAdd] }"""

    question_id: UUID
    display_order: int
    marks: Decimal = Decimal("4")
    negative_marks: Decimal = Decimal("1")
    subject_section: str | None = None


class TestPaperQuestionsIn(BaseModel):
    """Request body wrapper for bulk-adding questions to a test paper."""

    question_ids: list[TestPaperQuestionAdd] = Field(min_length=1)
