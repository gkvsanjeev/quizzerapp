from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.analysis import (
    AttemptsBreakdownOut,
    DifficultyOut,
    OverviewOut,
    PerformanceOut,
    QuestionDetailOut,
    QuestionJourneyOut,
    QuestionListOut,
    SubjectMovementOut,
    TimeOut,
)
from app.services import analysis_service
from app.services.analysis_service import AnalysisContext

router = APIRouter()


async def get_context(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisContext:
    attempt = await analysis_service.get_attempt(db, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    if not await analysis_service.authorize(db, attempt, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return await analysis_service.load_context(db, attempt)


@router.get("/{attempt_id}/overview", response_model=OverviewOut)
async def overview(
    ctx: AnalysisContext = Depends(get_context),
    db: AsyncSession = Depends(get_db),
):
    return await analysis_service.get_overview(db, ctx)


@router.get("/{attempt_id}/performance", response_model=PerformanceOut)
async def performance(
    ctx: AnalysisContext = Depends(get_context),
    db: AsyncSession = Depends(get_db),
):
    return await analysis_service.get_performance(db, ctx)


@router.get("/{attempt_id}/time", response_model=TimeOut)
async def time_analysis(ctx: AnalysisContext = Depends(get_context)):
    return analysis_service.get_time(ctx)


@router.get("/{attempt_id}/attempts", response_model=AttemptsBreakdownOut)
async def attempts_breakdown(ctx: AnalysisContext = Depends(get_context)):
    return analysis_service.get_attempts_breakdown(ctx)


@router.get("/{attempt_id}/difficulty", response_model=DifficultyOut)
async def difficulty(ctx: AnalysisContext = Depends(get_context)):
    return analysis_service.get_difficulty(ctx)


@router.get("/{attempt_id}/subject-movement", response_model=SubjectMovementOut)
async def subject_movement(ctx: AnalysisContext = Depends(get_context)):
    return analysis_service.get_subject_movement(ctx)


@router.get("/{attempt_id}/question-journey", response_model=QuestionJourneyOut)
async def question_journey(ctx: AnalysisContext = Depends(get_context)):
    return analysis_service.get_question_journey(ctx)


@router.get("/{attempt_id}/question/{question_id}", response_model=QuestionDetailOut)
async def question_detail(
    question_id: UUID,
    ctx: AnalysisContext = Depends(get_context),
):
    detail = analysis_service.get_question_detail(ctx, question_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Question not in this attempt"
        )
    return detail


@router.get("/{attempt_id}/questions", response_model=QuestionListOut)
async def question_list(
    ctx: AnalysisContext = Depends(get_context),
    subject_id: UUID | None = Query(None),
    result: str | None = Query(None),
):
    return analysis_service.get_question_list(ctx, subject_id=subject_id, result=result)
