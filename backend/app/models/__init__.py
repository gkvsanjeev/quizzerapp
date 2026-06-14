# Import all models here so SQLAlchemy metadata is fully populated for Alembic autogenerate.
# Always import in dependency order (no forward references needed at import time).
from app.models.base import Base
from app.models.user import RefreshToken, User
from app.models.exam import Exam, Subject, Topic
from app.models.rag import Document, DocumentChunk
from app.models.question import Option, Question
from app.models.test_paper import TestPaper, TestPaperQuestion
from app.models.attempt import Attempt, AttemptAnswer, AttemptSubjectStats, LeaderboardCache

__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "Exam",
    "Subject",
    "Topic",
    "Document",
    "DocumentChunk",
    "Question",
    "Option",
    "TestPaper",
    "TestPaperQuestion",
    "Attempt",
    "AttemptAnswer",
    "AttemptSubjectStats",
    "LeaderboardCache",
]
