from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Difficulty = Literal["easy", "medium", "hard"]
OptionKey = Literal["A", "B", "C", "D"]


# ─── Option ─────────────────────────────────────────────
class OptionCreate(BaseModel):
    option_key: OptionKey
    text: str
    image_url: str | None = None
    is_correct: bool


class OptionOut(BaseModel):
    """Teacher/admin-facing option. Note: omits `is_correct` to match the
    contract's OptionOut shape — it is never revealed in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    option_key: OptionKey
    text: str
    image_url: str | None = None


# ─── Question ───────────────────────────────────────────
class QuestionCreate(BaseModel):
    subject_id: UUID
    text: str
    difficulty: Difficulty
    options: list[OptionCreate] = Field(min_length=4, max_length=4)
    topic_id: UUID | None = None
    image_url: str | None = None
    explanation: str | None = None
    tags: list[str] = []


class QuestionUpdate(BaseModel):
    text: str | None = None
    image_url: str | None = None
    difficulty: Difficulty | None = None
    explanation: str | None = None
    tags: list[str] | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID
    topic_id: UUID | None = None
    text: str
    image_url: str | None = None
    difficulty: Difficulty
    explanation: str | None = None
    tags: list[str] = []
    source_doc_id: UUID | None = None
    created_at: datetime
    options: list[OptionOut] = []
