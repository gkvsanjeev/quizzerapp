import tempfile
import uuid
from collections.abc import Sequence
from pathlib import Path
from uuid import UUID

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PDFPlumberLoader
from langchain_openai import OpenAIEmbeddings
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.rag import DocStatus, Document, DocumentChunk
from app.schemas.rag import GeneratedQuestion


async def process_document(db: AsyncSession, document_id: UUID) -> None:
    document = await db.get(Document, document_id)
    if document is None:
        return

    document.processing_status = DocStatus.processing
    await db.commit()

    try:
        file_path = _download_to_temp(document.storage_url)

        raw_text = _extract_text(file_path, document.file_type)

        chunks = _chunk_text(raw_text)

        embeddings_model = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.OPENAI_API_KEY,
        )

        texts = [chunk["content"] for chunk in chunks]
        embedded = embeddings_model.embed_documents(texts)

        for chunk, embedding in zip(chunks, embedded, strict=False):
            db.add(
                DocumentChunk(
                    document_id=document_id,
                    content=chunk["content"],
                    chunk_index=chunk["chunk_index"],
                    page_number=chunk["page_number"],
                    chunk_metadata={"embedding": embedding},
                )
            )

        document.page_count = max(c["page_number"] or 0 for c in chunks) if chunks else None
        document.processing_status = DocStatus.ready
        await db.commit()
    except Exception:
        document.processing_status = DocStatus.failed
        await db.commit()


def _download_to_temp(storage_url: str) -> Path:
    import requests

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    r = requests.get(storage_url, stream=True, timeout=30)
    r.raise_for_status()
    for chunk in r.iter_content(chunk_size=8192):
        tmp.write(chunk)
    tmp.close()
    return Path(tmp.name)


def _extract_text(file_path: Path, file_type: str) -> str:
    if file_type in ("application/pdf",):
        try:
            loader = PDFPlumberLoader(str(file_path))
            pages = loader.load()
            return "\n\n".join(p.page_content for p in pages)
        except Exception:
            pass

    try:
        from PIL import Image

        import pytesseract

        if file_type.startswith("image/") or file_type == "application/pdf":
            img = Image.open(file_path)
            return pytesseract.image_to_string(img)
    except Exception:
        pass

    raise ValueError(f"Unsupported file type: {file_type}")


def _chunk_text(raw_text: str) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    doc_chunks = splitter.create_documents([raw_text])
    return [
        {
            "content": c.page_content,
            "chunk_index": i,
            "page_number": 1,
        }
        for i, c in enumerate(doc_chunks)
    ]


async def retrieve_chunks(
    db: AsyncSession,
    *,
    query_embedding: list[float],
    document_id: UUID | None = None,
    limit: int = 15,
) -> Sequence[dict]:
    embedding_vector = f"[{','.join(str(v) for v in query_embedding)}]"

    where_clause = ""
    params: dict = {"limit": limit}
    if document_id is not None:
        where_clause = "AND dc.document_id = :document_id"
        params["document_id"] = document_id

    sql = text(f"""
        SELECT
            dc.content,
            dc.page_number,
            d.filename,
            1 - (dc.chunk_metadata->'embedding'::text)::vector <=> :query_embedding AS similarity_score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.chunk_metadata->'embedding' IS NOT NULL
        {where_clause}
        ORDER BY dc.chunk_metadata->'embedding'::vector <=> :query_embedding
        LIMIT :limit
    """)

    result = await db.execute(
        sql,
        {
            "query_embedding": embedding_vector,
            **params,
        },
    )
    rows = result.fetchall()
    return [
        {
            "content": row[0],
            "page_number": row[1],
            "filename": row[2],
            "similarity_score": float(row[3]) if row[3] is not None else 0.0,
        }
        for row in rows
    ]


async def embed_text(text: str) -> list[float]:
    embeddings_model = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=settings.OPENAI_API_KEY,
    )
    return await embeddings_model.aembed_query(text)


def build_prompt(
    *,
    exam_type: str,
    subject: str,
    topic: str | None,
    difficulty: str,
    count: int,
    retrieved_chunks: str,
) -> str:
    topic_str = f" → {topic}" if topic else ""
    return f"""You are an expert exam question creator for {exam_type} preparation.
Generate exactly {count} multiple-choice questions at {difficulty} difficulty level
on the topic: {subject}{topic_str}.

Use ONLY the following source material to create questions:
<context>
{retrieved_chunks}
</context>

Return a JSON array where each element has:
- "text": question text (clear, unambiguous)
- "explanation": brief explanation of why the correct answer is right
- "options": array of exactly 4 objects with:
  - "option_key": one of "A", "B", "C", "D"
  - "text": option text
  - "is_correct": boolean (exactly one must be true)

Questions must be:
- Factually accurate based on the provided context only
- Appropriately challenging for {difficulty} level
- Not repetitive of each other"""


async def call_llm(prompt: str) -> list[GeneratedQuestion]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    if not content:
        return []

    import json

    data = json.loads(content)
    if isinstance(data, dict) and "questions" in data:
        data = data["questions"]
    return [GeneratedQuestion(**q) for q in data]


async def list_documents(db: AsyncSession, user_id: UUID) -> Sequence[Document]:
    stmt = select(Document).where(Document.uploaded_by == user_id).order_by(Document.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_document(db: AsyncSession, document_id: UUID) -> Document | None:
    return await db.get(Document, document_id)


async def save_generated_questions(
    db: AsyncSession,
    *,
    subject_id: UUID,
    topic_id: UUID | None,
    created_by: UUID,
    questions: list[GeneratedQuestion],
    source_doc_id: UUID | None = None,
) -> tuple[int, list[UUID]]:
    from app.models.question import Difficulty, Option, Question

    saved_ids: list[UUID] = []
    for q in questions:
        question_id = uuid.uuid4()
        db.add(
            Question(
                id=question_id,
                subject_id=subject_id,
                topic_id=topic_id,
                text=q.text,
                difficulty=Difficulty("medium"),
                explanation=q.explanation,
                source_doc_id=source_doc_id,
                created_by=created_by,
                options=[
                    Option(
                        id=uuid.uuid4(),
                        question_id=question_id,
                        option_key=o.option_key,
                        text=o.text,
                        is_correct=o.is_correct,
                    )
                    for o in q.options
                ],
            )
        )
        saved_ids.append(question_id)

    await db.commit()
    return len(saved_ids), saved_ids
