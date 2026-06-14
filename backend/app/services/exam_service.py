from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, Subject
from app.schemas.exam import ExamCreate, ExamUpdate, SubjectCreate


def _with_subjects():
    # Subjects use lazy="raise"; eager-load them (and their topics) so ExamOut
    # can serialize the nested relationship without triggering a lazy load.
    return selectinload(Exam.subjects).selectinload(Subject.topics)


async def list_exams(
    db: AsyncSession,
    *,
    page: int,
    limit: int,
    exam_type: str | None = None,
    published: bool | None = None,
) -> tuple[list[Exam], int]:
    stmt = select(Exam)
    if exam_type is not None:
        stmt = stmt.where(Exam.exam_type == exam_type)
    if published is not None:
        stmt = stmt.where(Exam.is_published.is_(published))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    page_stmt = (
        stmt.options(_with_subjects())
        .order_by(Exam.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await db.execute(page_stmt)).scalars().all()
    return list(rows), total


async def get_exam(db: AsyncSession, exam_id: UUID) -> Exam | None:
    stmt = select(Exam).where(Exam.id == exam_id).options(_with_subjects())
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_exam(db: AsyncSession, data: ExamCreate, created_by: UUID) -> Exam:
    exam = Exam(
        title=data.title,
        exam_type=data.exam_type,
        description=data.description,
        created_by=created_by,
    )
    db.add(exam)
    await db.commit()
    # Re-fetch with subjects eager-loaded for a clean ExamOut serialization.
    return await get_exam(db, exam.id)


async def update_exam(db: AsyncSession, exam_id: UUID, data: ExamUpdate) -> Exam | None:
    exam = await get_exam(db, exam_id)
    if exam is None:
        return None

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)

    await db.commit()
    return await get_exam(db, exam_id)


async def exam_exists(db: AsyncSession, exam_id: UUID) -> bool:
    result = await db.execute(select(Exam.id).where(Exam.id == exam_id))
    return result.scalar_one_or_none() is not None


async def list_subjects(db: AsyncSession, exam_id: UUID) -> list[Subject]:
    stmt = (
        select(Subject)
        .where(Subject.exam_id == exam_id)
        .options(selectinload(Subject.topics))
        .order_by(Subject.order_index)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


async def create_subject(db: AsyncSession, exam_id: UUID, data: SubjectCreate) -> Subject:
    subject = Subject(exam_id=exam_id, name=data.name, order_index=data.order_index)
    db.add(subject)
    await db.commit()
    # Re-fetch with topics eager-loaded (topics use lazy="raise").
    result = await db.execute(
        select(Subject).where(Subject.id == subject.id).options(selectinload(Subject.topics))
    )
    return result.scalar_one()
