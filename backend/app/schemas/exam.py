from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ─── Topic ──────────────────────────────────────────────
class TopicCreate(BaseModel):
    name: str


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


# ─── Subject ────────────────────────────────────────────
class SubjectCreate(BaseModel):
    name: str
    order_index: int = 0


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    order_index: int
    topics: list[TopicOut] = []


# ─── Exam ───────────────────────────────────────────────
class ExamCreate(BaseModel):
    title: str
    exam_type: str
    description: str | None = None


class ExamUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_published: bool | None = None


class ExamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    exam_type: str
    is_published: bool
    created_by: UUID
    created_at: datetime
    subjects: list[SubjectOut] | None = None
