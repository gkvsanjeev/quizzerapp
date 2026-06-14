from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.question import Difficulty, Option, Question
from app.schemas.question import QuestionCreate, QuestionUpdate


def _with_options():
    # Options use lazy="raise"; eager-load them so QuestionOut can serialize the
    # nested relationship without triggering a lazy load.
    return selectinload(Question.options)


async def get_question(db: AsyncSession, question_id: UUID) -> Question | None:
    stmt = select(Question).where(Question.id == question_id).options(_with_options())
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_questions(
    db: AsyncSession,
    *,
    page: int,
    limit: int,
    subject_id: UUID | None = None,
    topic_id: UUID | None = None,
    difficulty: Difficulty | None = None,
) -> tuple[list[Question], int]:
    stmt = select(Question)
    if subject_id is not None:
        stmt = stmt.where(Question.subject_id == subject_id)
    if topic_id is not None:
        stmt = stmt.where(Question.topic_id == topic_id)
    if difficulty is not None:
        stmt = stmt.where(Question.difficulty == difficulty)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    page_stmt = (
        stmt.options(_with_options())
        .order_by(Question.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await db.execute(page_stmt)).scalars().all()
    return list(rows), total


async def create_question(db: AsyncSession, data: QuestionCreate, created_by: UUID) -> Question:
    question = Question(
        subject_id=data.subject_id,
        topic_id=data.topic_id,
        text=data.text,
        image_url=data.image_url,
        difficulty=Difficulty(data.difficulty),
        explanation=data.explanation,
        tags=data.tags,
        created_by=created_by,
        options=[
            Option(
                option_key=o.option_key,
                text=o.text,
                image_url=o.image_url,
                is_correct=o.is_correct,
            )
            for o in data.options
        ],
    )
    db.add(question)
    await db.commit()
    # Re-fetch with options eager-loaded for a clean QuestionOut serialization.
    return await get_question(db, question.id)


async def update_question(
    db: AsyncSession, question_id: UUID, data: QuestionUpdate
) -> Question | None:
    question = await get_question(db, question_id)
    if question is None:
        return None

    updates = data.model_dump(exclude_unset=True)
    if updates.get("difficulty") is not None:
        updates["difficulty"] = Difficulty(updates["difficulty"])
    for field, value in updates.items():
        setattr(question, field, value)

    await db.commit()
    return await get_question(db, question_id)


async def delete_question(db: AsyncSession, question: Question) -> None:
    await db.delete(question)
    await db.commit()
