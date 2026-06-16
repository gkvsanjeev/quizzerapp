import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.config import settings
from app.models.rag import DocStatus, Document
from app.models.user import User
from app.schemas.rag import (
    ChunkResult,
    DocumentOut,
    GeneratedQuestion,
    GenerateQuestionsIn,
    SaveQuestionsIn,
    SaveQuestionsOut,
    SearchResult,
)
from app.services import rag_service

router = APIRouter()

MAX_UPLOAD_SIZE = 50 * 1024 * 1024
ALLOWED_FILE_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/tiff": ".tiff",
}


async def _save_to_storage(file: UploadFile, file_id: uuid.UUID) -> str:
    suffix = ALLOWED_FILE_TYPES.get(file.content_type or "", ".bin")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await file.read()
    tmp.write(content)
    tmp.close()

    local_path = Path(settings.VERCEL_BLOB_READ_WRITE_TOKEN or "uploads")
    os.makedirs(str(local_path), exist_ok=True)
    dest = local_path / f"{file_id}{suffix}"
    dest.write_bytes(content)
    return str(dest)


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {', '.join(ALLOWED_FILE_TYPES)}",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 50MB.",
        )
    await file.seek(0)

    doc_id = uuid.uuid4()
    storage_url = await _save_to_storage(file, doc_id)

    document = Document(
        id=doc_id,
        uploaded_by=current_user.id,
        filename=file.filename or "untitled",
        file_type=file.content_type or "application/octet-stream",
        storage_url=storage_url,
        processing_status=DocStatus.pending,
    )
    db.add(document)
    await db.commit()

    background_tasks.add_task(rag_service.process_document, db, doc_id)

    return {"document_id": str(doc_id), "status": DocStatus.pending.value}


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    return await rag_service.list_documents(db, current_user.id)


@router.get("/documents/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    doc = await rag_service.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.post("/generate-questions", response_model=list[GeneratedQuestion])
async def generate_questions(
    body: GenerateQuestionsIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    query = f"{body.difficulty} {body.subject_id}"
    if body.topic_id:
        query += f" {body.topic_id}"

    query_embedding = await rag_service.embed_text(query)

    chunks = await rag_service.retrieve_chunks(
        db,
        query_embedding=query_embedding,
        document_id=body.document_id,
        limit=15,
    )

    context_text = "\n\n".join(c["content"] for c in chunks)

    prompt = rag_service.build_prompt(
        exam_type="competitive exam",
        subject=str(body.subject_id),
        topic=str(body.topic_id) if body.topic_id else None,
        difficulty=body.difficulty,
        count=body.count,
        retrieved_chunks=context_text,
    )

    return await rag_service.call_llm(prompt)


@router.post("/questions/save", response_model=SaveQuestionsOut)
async def save_questions(
    body: SaveQuestionsIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    saved_count, question_ids = await rag_service.save_generated_questions(
        db,
        subject_id=body.subject_id,
        topic_id=body.topic_id,
        created_by=current_user.id,
        questions=body.questions,
    )
    return SaveQuestionsOut(saved_count=saved_count, question_ids=question_ids)


@router.get("/search", response_model=SearchResult)
async def search(
    query: str = Query(...),
    document_id: uuid.UUID | None = Query(None),
    limit: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin")),
):
    query_embedding = await rag_service.embed_text(query)
    chunks = await rag_service.retrieve_chunks(
        db,
        query_embedding=query_embedding,
        document_id=document_id,
        limit=limit,
    )
    return SearchResult(chunks=[ChunkResult(**c) for c in chunks])
