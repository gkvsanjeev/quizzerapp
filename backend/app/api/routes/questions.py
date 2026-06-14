from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.models.question import Difficulty
from app.models.user import User
from app.schemas.question import QuestionCreate, QuestionOut, QuestionUpdate
from app.services import question_service

router = APIRouter()


@router.get("")
async def list_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    subject_id: UUID | None = Query(None),
    topic_id: UUID | None = Query(None),
    difficulty: Difficulty | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rows, total = await question_service.list_questions(
        db,
        page=page,
        limit=limit,
        subject_id=subject_id,
        topic_id=topic_id,
        difficulty=difficulty,
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [QuestionOut.model_validate(q) for q in rows],
    }


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("teacher", "admin")),
):
    question = await question_service.create_question(db, data, user.id)
    return QuestionOut.model_validate(question)


@router.put("/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: UUID,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("teacher", "admin")),
):
    question = await question_service.update_question(db, question_id, data)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return QuestionOut.model_validate(question)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("teacher", "admin")),
):
    question = await question_service.get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    # Ownership: only the creating teacher (or an admin) may delete.
    if user.role.value != "admin" and question.created_by != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    await question_service.delete_question(db, question)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
