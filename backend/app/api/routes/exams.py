from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.exam import ExamCreate, ExamOut, ExamUpdate, SubjectCreate, SubjectOut
from app.schemas.test_paper import TestPaperCreate, TestPaperOut
from app.services import exam_service, test_paper_service

router = APIRouter()


@router.get("")
async def list_exams(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    exam_type: str | None = Query(None),
    published: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rows, total = await exam_service.list_exams(
        db, page=page, limit=limit, exam_type=exam_type, published=published
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [ExamOut.model_validate(e) for e in rows],
    }


@router.post("", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam(
    data: ExamCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("teacher", "admin")),
):
    exam = await exam_service.create_exam(db, data, user.id)
    return ExamOut.model_validate(exam)


@router.get("/{exam_id}", response_model=ExamOut)
async def get_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    exam = await exam_service.get_exam(db, exam_id)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return ExamOut.model_validate(exam)


@router.put("/{exam_id}", response_model=ExamOut)
async def update_exam(
    exam_id: UUID,
    data: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("teacher", "admin")),
):
    exam = await exam_service.update_exam(db, exam_id, data)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return ExamOut.model_validate(exam)


@router.get("/{exam_id}/subjects", response_model=list[SubjectOut])
async def list_subjects(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not await exam_service.exam_exists(db, exam_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    subjects = await exam_service.list_subjects(db, exam_id)
    return [SubjectOut.model_validate(s) for s in subjects]


@router.post(
    "/{exam_id}/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED
)
async def create_subject(
    exam_id: UUID,
    data: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("teacher", "admin")),
):
    if not await exam_service.exam_exists(db, exam_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    subject = await exam_service.create_subject(db, exam_id, data)
    return SubjectOut.model_validate(subject)


@router.get("/{exam_id}/test-papers", response_model=list[TestPaperOut])
async def list_test_papers(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not await exam_service.exam_exists(db, exam_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    papers = await test_paper_service.list_test_papers(db, exam_id)
    return [TestPaperOut.model_validate(p) for p in papers]


@router.post(
    "/{exam_id}/test-papers", response_model=TestPaperOut, status_code=status.HTTP_201_CREATED
)
async def create_test_paper(
    exam_id: UUID,
    data: TestPaperCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("teacher", "admin")),
):
    if not await exam_service.exam_exists(db, exam_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    paper = await test_paper_service.create_test_paper(db, exam_id, data, user.id)
    return TestPaperOut.model_validate(paper)
