# RAG Pipeline — QuizzerApp

## Overview

The RAG (Retrieval-Augmented Generation) pipeline enables teachers/admins to upload exam preparation material (PDFs, scanned images) and automatically generate MCQ questions from that content using an LLM. Generated questions are reviewed before being added to the question bank.

---

## Pipeline Steps

```
1. UPLOAD     Teacher uploads PDF/image via POST /api/rag/upload
              → File stored in Vercel Blob (or S3)
              → Document record created with status='pending'
              → Background task enqueued

2. EXTRACT    pdfplumber extracts text from each PDF page
              pytesseract OCR for scanned PDFs and image files
              → Raw text per page stored in memory

3. CHUNK      LangChain RecursiveCharacterTextSplitter
              chunk_size=500 tokens, chunk_overlap=50 tokens
              → List of (content, chunk_index, page_number) tuples

4. EMBED      OpenAI text-embedding-3-small model
              → 1536-dimensional float32 vectors
              Batched 100 chunks per API call for efficiency

5. STORE      INSERT INTO document_chunks (content, chunk_index, page_number, embedding)
              Document status updated to 'ready'
              IVFFlat index built/refreshed if chunk count > 1000

6. QUERY      Teacher enters: subject, topic, difficulty, count
              LLM generates a query from these params
              → embed query → pgvector cosine similarity search
              → top-k=15 chunks retrieved as context

7. GENERATE   Claude claude-sonnet-4-6 (or GPT-4o) called with structured output prompt:
              "Generate {count} {difficulty} MCQ questions on {subject}/{topic}
               from the following exam material. For each question provide:
               text, 4 options (A/B/C/D), mark exactly one correct, explanation."
              → Pydantic-validated JSON list of GeneratedQuestion

8. REVIEW     Frontend shows generated questions with correct answers highlighted
              Teacher can edit text, change correct answer, delete questions

9. SAVE       POST /api/rag/questions/save → bulk insert into questions + options tables
              source_doc_id set so questions are traceable to source document
```

---

## Service: `rag_service.py`

```python
class RAGService:
    async def process_document(document_id: UUID) -> None
        # Steps 2-5: extract, chunk, embed, store

    async def generate_questions(
        document_id: UUID,
        subject_id: UUID,
        topic_id: UUID | None,
        count: int,
        difficulty: str,
    ) -> list[GeneratedQuestion]
        # Steps 6-7: retrieve chunks, call LLM

    async def semantic_search(
        query: str,
        document_id: UUID | None,
        limit: int = 5,
    ) -> list[ChunkResult]
        # Embed query, run pgvector cosine similarity
```

---

## pgvector Query Pattern

```sql
SELECT
    content,
    page_number,
    d.filename,
    1 - (embedding <=> $1::vector) AS similarity_score
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE ($2::uuid IS NULL OR dc.document_id = $2)
ORDER BY embedding <=> $1::vector
LIMIT $3;
```
`$1` = query embedding vector, `$2` = optional document_id filter, `$3` = limit

---

## LLM Prompt Template

```
You are an expert exam question creator for {exam_type} preparation.
Generate exactly {count} multiple-choice questions at {difficulty} difficulty level
on the topic: {subject} → {topic}.

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
- Not repetitive of each other
```

---

## Background Processing

Since Vercel serverless functions have a 10-second timeout (Hobby) or 60s (Pro), document processing runs as a **background task** using FastAPI's `BackgroundTasks`:

```python
@router.post("/upload", status_code=202)
async def upload_document(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("teacher")),
):
    doc = await save_document_record(db, file, current_user.id)
    blob_url = await upload_to_vercel_blob(file)
    background_tasks.add_task(rag_service.process_document, doc.id)
    return { "document_id": doc.id, "status": "pending" }
```

For production at scale, consider migrating to a queue (Inngest, Vercel Cron + queue) for reliable processing.

---

## Supported File Types

| Type | Extraction Method |
|---|---|
| PDF (text-based) | pdfplumber |
| PDF (scanned/image) | pdfplumber + pytesseract fallback |
| PNG / JPEG / WEBP | pytesseract |
| TIFF | pytesseract |

Max upload size: 50MB per file.

---

## Environment Variables Required

```
OPENAI_API_KEY          # For text-embedding-3-small and GPT-4o generation
VERCEL_BLOB_READ_WRITE_TOKEN  # For file storage
# OR
AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  # If using S3
```

To use Claude instead of OpenAI for question generation:
```
ANTHROPIC_API_KEY       # claude-sonnet-4-6
```
Change `rag_service.py` → `generate_questions()` to use `anthropic` SDK with structured output.

---

## Cost Estimates (OpenAI)

| Operation | Model | Cost |
|---|---|---|
| Embedding 1000 chunks (500 tokens each) | text-embedding-3-small | ~$0.10 |
| Generate 10 questions | gpt-4o (4k input, 1k output) | ~$0.02 |
