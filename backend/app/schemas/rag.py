import enum
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class DocStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class DocumentOut(BaseModel):
    id: UUID
    filename: str
    file_type: str
    processing_status: DocStatus
    page_count: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateQuestionsIn(BaseModel):
    document_id: UUID
    subject_id: UUID
    topic_id: UUID | None = None
    count: int
    difficulty: Literal["easy", "medium", "hard"]


class GeneratedOption(BaseModel):
    option_key: Literal["A", "B", "C", "D"]
    text: str
    is_correct: bool


class GeneratedQuestion(BaseModel):
    text: str
    explanation: str
    options: list[GeneratedOption]


class SaveQuestionsIn(BaseModel):
    subject_id: UUID
    topic_id: UUID | None = None
    questions: list[GeneratedQuestion]


class SaveQuestionsOut(BaseModel):
    saved_count: int
    question_ids: list[UUID]


class ChunkResult(BaseModel):
    content: str
    page_number: int | None = None
    filename: str
    similarity_score: float


class SearchResult(BaseModel):
    chunks: list[ChunkResult]