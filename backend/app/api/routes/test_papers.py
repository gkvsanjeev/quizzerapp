from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.user import User
from app.schemas.test_paper import TestPaperQuestionsIn
from app.services import test_paper_service

router = APIRouter()


@router.post("/{test_paper_id}/questions")
async def add_questions(
    test_paper_id: UUID,
    data: TestPaperQuestionsIn,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("teacher", "admin")),
):
    paper = await test_paper_service.get_test_paper(db, test_paper_id)
    if paper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test paper not found")
    added = await test_paper_service.add_questions(db, test_paper_id, data.question_ids)
    return {"added": added}
