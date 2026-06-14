import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TestPaper(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_papers"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("exams.id"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    total_marks: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    negative_marking_factor: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("0.25")
    )
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    paper_questions: Mapped[list["TestPaperQuestion"]] = relationship(
        back_populates="test_paper",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class TestPaperQuestion(Base):
    __tablename__ = "test_paper_questions"

    test_paper_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("test_papers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("questions.id"),
        primary_key=True,
    )
    marks: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("4"))
    negative_marks: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("1")
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_section: Mapped[str | None] = mapped_column(String, nullable=True)

    test_paper: Mapped["TestPaper"] = relationship(back_populates="paper_questions", lazy="raise")
