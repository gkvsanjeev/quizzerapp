from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.models.attempt import Attempt, AttemptStatus
from app.models.user import User
from app.schemas.attempt import (
    AnswerUpdate,
    AttemptCreate,
    AttemptResultOut,
    AttemptStateOut,
    AttemptSummaryOut,
)
from app.services import attempt_service

router = APIRouter()


async def _load_owned_attempt(
    attempt_id: UUID, db: AsyncSession, user: User, *, allow_admin: bool = True
) -> Attempt:
    attempt = await attempt_service.get_attempt(db, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    is_owner = attempt.user_id == user.id
    is_admin = allow_admin and user.role.value == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return attempt


@router.post("", response_model=AttemptStateOut, status_code=status.HTTP_201_CREATED)
async def start_attempt(
    data: AttemptCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("student")),
):
    paper_exam = await attempt_service.get_paper_with_exam(db, data.test_paper_id)
    if paper_exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test paper not found")
    paper, exam = paper_exam
    if not exam.is_published:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Test paper is not available"
        )
    if await attempt_service.find_attempt(db, user.id, paper.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You have already attempted this paper"
        )
    attempt = await attempt_service.create_attempt(db, user.id, paper.id)
    return await attempt_service.build_state(db, attempt, paper)


@router.get("", response_model=list[AttemptSummaryOut])
async def list_attempts(
    test_paper_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = await attempt_service.list_attempts(
        db, user_id=user.id, test_paper_id=test_paper_id
    )
    return [
        AttemptSummaryOut(
            id=a.id,
            test_paper_id=a.test_paper_id,
            test_paper_title=title,
            status=a.status.value,
            started_at=a.started_at,
            submitted_at=a.submitted_at,
            final_score=a.final_score,
            rank=a.rank,
            percentile=a.percentile,
        )
        for a, title in rows
    ]


@router.get("/{attempt_id}", response_model=AttemptStateOut)
async def resume_attempt(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await _load_owned_attempt(attempt_id, db, user)
    paper_exam = await attempt_service.get_paper_with_exam(db, attempt.test_paper_id)
    if paper_exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test paper not found")
    return await attempt_service.build_state(db, attempt, paper_exam[0])


@router.put("/{attempt_id}/answer")
async def save_answer(
    attempt_id: UUID,
    data: AnswerUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await _load_owned_attempt(attempt_id, db, user, allow_admin=False)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt is not in progress"
        )
    await attempt_service.save_answer(db, attempt.id, data)
    return {"saved": True}


@router.post("/{attempt_id}/submit", response_model=AttemptResultOut)
async def submit_attempt(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await _load_owned_attempt(attempt_id, db, user, allow_admin=False)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt already submitted"
        )
    return await attempt_service.submit_attempt(db, attempt)
