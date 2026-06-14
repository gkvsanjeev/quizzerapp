import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AttemptStatus(str, enum.Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    timed_out = "timed_out"


class Attempt(Base, UUIDMixin):
    __tablename__ = "attempts"
    # One attempt per user per paper (per docs/specifications/database-design.md).
    __table_args__ = (UniqueConstraint("user_id", "test_paper_id", name="uq_attempt_user_paper"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    test_paper_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("test_papers.id"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[AttemptStatus] = mapped_column(
        SAEnum(AttemptStatus, name="attempt_status"),
        nullable=False,
        default=AttemptStatus.in_progress,
    )
    raw_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    final_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    percentile: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    answers: Mapped[list["AttemptAnswer"]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    subject_stats: Mapped[list["AttemptSubjectStats"]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class AttemptAnswer(Base, UUIDMixin):
    __tablename__ = "attempt_answers"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("questions.id"),
        nullable=False,
    )
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("options.id"),
        nullable=True,
    )
    time_spent_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_visited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_visited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    visit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_marked_for_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    change_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    attempt: Mapped["Attempt"] = relationship(back_populates="answers", lazy="raise")


class AttemptSubjectStats(Base, UUIDMixin):
    __tablename__ = "attempt_subject_stats"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("subjects.id"),
        nullable=False,
    )
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unattempted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("0"))
    max_score: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("0"))

    attempt: Mapped["Attempt"] = relationship(back_populates="subject_stats", lazy="raise")


class LeaderboardCache(Base, UUIDMixin):
    __tablename__ = "leaderboard_cache"

    test_paper_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("test_papers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )
    data: Mapped[Any] = mapped_column(JSONB, nullable=False)
