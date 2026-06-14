from typing import Literal
from uuid import UUID

from pydantic import BaseModel

Difficulty = Literal["easy", "medium", "hard"]
QuestionResult = Literal["correct", "incorrect", "unattempted"]


# ─── Overview ───────────────────────────────────────────
class OverviewOut(BaseModel):
    score: float
    max_score: float
    percentage: float
    rank: int | None = None
    percentile: float | None = None
    total_questions: int
    attempted: int
    correct: int
    incorrect: int
    unattempted: int
    accuracy_percentage: float
    time_taken_seconds: int
    duration_seconds: int
    topper_score: float | None = None
    average_score: float | None = None


# ─── Performance (by subject) ───────────────────────────
class SubjectPerformance(BaseModel):
    name: str
    score: float
    max_score: float
    percentage: float
    topper_score: float | None = None
    average_score: float | None = None


class PerformanceOut(BaseModel):
    subjects: list[SubjectPerformance]


# ─── Time ───────────────────────────────────────────────
class SubjectTime(BaseModel):
    name: str
    time_seconds: int


class TimeByDifficulty(BaseModel):
    easy: int = 0
    medium: int = 0
    hard: int = 0


class QuestionTime(BaseModel):
    question_id: UUID
    time_seconds: int
    difficulty: Difficulty
    result: QuestionResult


class TimeOut(BaseModel):
    total_time_seconds: int
    avg_time_per_question_seconds: int
    subjects: list[SubjectTime]
    difficulty: TimeByDifficulty
    questions: list[QuestionTime]


# ─── Attempts breakdown ─────────────────────────────────
class AttemptsBreakdownOut(BaseModel):
    correct: int
    incorrect: int
    skipped: int
    unattempted: int
    marked_for_review: int
    net_score: float
    gross_score: float
    negative_marks: float


# ─── Difficulty breakdown ───────────────────────────────
class DifficultyBucket(BaseModel):
    total: int = 0
    correct: int = 0
    incorrect: int = 0
    unattempted: int = 0
    accuracy: float = 0.0


class DifficultyOut(BaseModel):
    easy: DifficultyBucket
    medium: DifficultyBucket
    hard: DifficultyBucket


# ─── Subject movement ───────────────────────────────────
class SubjectTransition(BaseModel):
    from_subject: str
    to_subject: str
    at_question_number: int
    at_time_seconds: int


class TimeInSubject(BaseModel):
    subject: str
    total_seconds: int
    visit_count: int


class SubjectMovementOut(BaseModel):
    transitions: list[SubjectTransition]
    time_in_subject: list[TimeInSubject]


# ─── Question journey ───────────────────────────────────
JourneyEvent = Literal[
    "visited", "answered", "marked_for_review", "revisited", "answer_changed"
]


class JourneyEntry(BaseModel):
    question_id: UUID
    question_number: int
    event: JourneyEvent
    timestamp_seconds: int


class QuestionJourneyOut(BaseModel):
    events: list[JourneyEntry]


# ─── Single question detail ─────────────────────────────
class QuestionDetailOption(BaseModel):
    option_key: str
    text: str
    is_correct: bool
    selected: bool


class QuestionDetailOut(BaseModel):
    question_id: UUID
    question_number: int
    text: str
    difficulty: Difficulty
    subject: str
    topic: str | None = None
    your_answer: str | None = None
    correct_answer: str | None = None
    is_correct: bool
    time_spent_seconds: int
    visit_count: int
    change_count: int
    is_marked_for_review: bool
    explanation: str | None = None
    options: list[QuestionDetailOption]


# ─── Question-by-question table ─────────────────────────
class QuestionListItem(BaseModel):
    question_id: UUID
    question_number: int
    subject: str
    topic: str | None = None
    difficulty: Difficulty
    your_answer: str | None = None
    correct_answer: str | None = None
    is_correct: bool
    time_spent_seconds: int
    result: QuestionResult


class QuestionListOut(BaseModel):
    questions: list[QuestionListItem]
