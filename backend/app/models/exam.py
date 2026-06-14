import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Exam(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exams"

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    exam_type: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="exam",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class Subject(Base, UUIDMixin):
    __tablename__ = "subjects"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("exams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    exam: Mapped["Exam"] = relationship(back_populates="subjects", lazy="raise")
    topics: Mapped[list["Topic"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class Topic(Base, UUIDMixin):
    __tablename__ = "topics"

    subject_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)

    subject: Mapped["Subject"] = relationship(back_populates="topics", lazy="raise")
