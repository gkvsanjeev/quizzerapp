# /generate-test

Use the RAG pipeline to auto-generate a test paper from uploaded documents.

## Usage
```
/generate-test
```

## What this does

1. Ask me for:
   - Document to use (list available via `GET /api/rag/documents`)
   - Subject and topic
   - Number of questions (e.g. 30)
   - Difficulty mix (e.g. "10 easy, 15 medium, 5 hard")
   - Test paper title and duration

2. Call `POST /api/rag/generate-questions` for each difficulty batch

3. Display generated questions for review (user can edit/reject)

4. Call `POST /api/rag/questions/save` to save approved questions

5. Create a test paper: `POST /api/exams/{exam_id}/test-papers`

6. Assign questions to test paper: `POST /api/test-papers/{id}/questions`

## Flow

```
List documents → Select document
→ Generate easy batch → Generate medium batch → Generate hard batch
→ Review all questions in terminal
→ Save approved questions
→ Create test paper with saved questions
```

## Notes
- Generation may take 10-30 seconds depending on chunk count and LLM latency
- Always review generated questions for factual accuracy before saving
- Generated questions are linked to source document via `source_doc_id`
