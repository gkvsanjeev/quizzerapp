from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_paper import TestPaper, TestPaperQuestion
from app.schemas.test_paper import TestPaperCreate, TestPaperQuestionAdd


async def list_test_papers(db: AsyncSession, exam_id: UUID) -> list[TestPaper]:
    stmt = (
        select(TestPaper)
        .where(TestPaper.exam_id == exam_id)
        .order_by(TestPaper.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_test_paper(db: AsyncSession, paper_id: UUID) -> TestPaper | None:
    return (
        await db.execute(select(TestPaper).where(TestPaper.id == paper_id))
    ).scalar_one_or_none()


async def create_test_paper(
    db: AsyncSession, exam_id: UUID, data: TestPaperCreate, created_by: UUID
) -> TestPaper:
    paper = TestPaper(
        exam_id=exam_id,
        title=data.title,
        duration_seconds=data.duration_seconds,
        total_marks=data.total_marks,
        scheduled_at=data.scheduled_at,
        negative_marking_factor=data.negative_marking_factor,
        shuffle_questions=data.shuffle_questions,
        shuffle_options=data.shuffle_options,
        created_by=created_by,
    )
    db.add(paper)
    await db.commit()
    # created_at is a server-side default; refresh to populate it for TestPaperOut.
    await db.refresh(paper)
    return paper


async def add_questions(
    db: AsyncSession, paper_id: UUID, items: Sequence[TestPaperQuestionAdd]
) -> int:
    for item in items:
        db.add(
            TestPaperQuestion(
                test_paper_id=paper_id,
                question_id=item.question_id,
                display_order=item.display_order,
                marks=item.marks,
                negative_marks=item.negative_marks,
                subject_section=item.subject_section,
            )
        )
    await db.commit()
    return len(items)
