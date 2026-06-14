# API Specification — QuizzerApp

**Base URL**: `/api` (all routes prefixed)
**Auth**: Bearer token in `Authorization: Bearer <access_token>` header
**Content-Type**: `application/json` (multipart for file uploads)

---

## Auth Routes (`/api/auth`)

### POST /api/auth/register
**Body**: `{ email, name, password, role? }`
**Response 201**: `{ user: UserOut, access_token, token_type: "bearer" }`
Refresh token set as httpOnly cookie.

### POST /api/auth/login
**Body**: `{ email, password }`
**Response 200**: `{ access_token, token_type: "bearer", user: UserOut }`
Refresh token set as httpOnly cookie `refresh_token`.

### POST /api/auth/refresh
**Requires**: httpOnly cookie `refresh_token`
**Response 200**: `{ access_token, token_type: "bearer" }`
Old refresh token revoked; new one issued and set in cookie.

### POST /api/auth/logout
**Requires**: Auth
**Response 204**: Revokes refresh token. Clears cookie.

### GET /api/auth/me
**Requires**: Auth
**Response 200**: `UserOut`

---

## Exam Routes (`/api/exams`) — Admin/Teacher only for writes

### GET /api/exams
**Requires**: Auth
**Query**: `?page=1&limit=20&exam_type=JEE&published=true`
**Response 200**: `{ items: ExamOut[], total, page, limit }`

### POST /api/exams
**Requires**: Role `teacher` or `admin`
**Body**: `{ title, description, exam_type }`
**Response 201**: `ExamOut`

### GET /api/exams/{exam_id}
**Response 200**: `ExamOut` with subjects

### PUT /api/exams/{exam_id}
**Requires**: Owner or admin
**Body**: `{ title?, description?, exam_type?, is_published? }`
**Response 200**: `ExamOut`

### GET /api/exams/{exam_id}/subjects
**Response 200**: `SubjectOut[]` with topics

### POST /api/exams/{exam_id}/subjects
**Requires**: Owner or admin
**Body**: `{ name, order_index? }`
**Response 201**: `SubjectOut`

### GET /api/exams/{exam_id}/test-papers
**Response 200**: `TestPaperOut[]`

### POST /api/exams/{exam_id}/test-papers
**Requires**: Owner or admin
**Body**: `{ title, scheduled_at?, duration_seconds, total_marks, negative_marking_factor?, shuffle_questions?, shuffle_options? }`
**Response 201**: `TestPaperOut`

---

## Question Routes (`/api/questions`)

### GET /api/questions
**Requires**: Auth
**Query**: `?subject_id=&topic_id=&difficulty=easy&tags[]=math&page=1&limit=20`
**Response 200**: `{ items: QuestionOut[], total, page, limit }`

### POST /api/questions
**Requires**: Role `teacher` or `admin`
**Body**: `{ subject_id, topic_id?, text, image_url?, difficulty, explanation?, tags?, options: [{ option_key, text, image_url?, is_correct }] }`
**Response 201**: `QuestionOut` with options

### PUT /api/questions/{question_id}
**Body**: Same as POST (partial)
**Response 200**: `QuestionOut`

### DELETE /api/questions/{question_id}
**Response 204**

### POST /api/test-papers/{test_paper_id}/questions
**Requires**: Paper owner or admin
**Body**: `{ question_ids: [{ question_id, marks?, negative_marks?, display_order }] }`
**Response 200**: `{ added: number }`

---

## Attempt Routes (`/api/attempts`)

### POST /api/attempts
**Requires**: Auth (student)
**Body**: `{ test_paper_id }`
**Response 201**: `AttemptStateOut` — full attempt state for resuming
```json
{
  "attempt_id": "uuid",
  "test_paper": { "id", "title", "duration_seconds", "total_marks" },
  "questions": [{ "id", "text", "image_url", "options": [{ "id", "option_key", "text" }] }],
  "answers": { "question_id": { "selected_option_id", "is_marked_for_review", "visit_count" } },
  "started_at": "iso8601",
  "time_elapsed_seconds": 0
}
```

### GET /api/attempts/{attempt_id}
**Requires**: Attempt owner or admin
**Response 200**: `AttemptStateOut` (same as above, for resume)

### PUT /api/attempts/{attempt_id}/answer
**Requires**: Attempt owner
**Body**: `{ question_id, selected_option_id, time_spent_delta_seconds, is_marked_for_review? }`
**Response 200**: `{ saved: true }`
Called every 10s for autosave and on every option click.

### POST /api/attempts/{attempt_id}/submit
**Requires**: Attempt owner
**Response 200**: `AttemptResultOut`
```json
{
  "attempt_id": "uuid",
  "raw_score": 120,
  "final_score": 110.5,
  "rank": 42,
  "percentile": 94.2,
  "total_questions": 90,
  "attempted": 78,
  "correct": 65,
  "incorrect": 13
}
```

### GET /api/attempts
**Requires**: Auth
**Query**: `?user_id=&test_paper_id=`
**Response 200**: `AttemptSummaryOut[]`

---

## Analysis Routes (`/api/analysis/{attempt_id}`)

All require: Auth (attempt owner, teacher for their students, or admin)

### GET /api/analysis/{attempt_id}/overview
```json
{
  "score": 110.5,
  "max_score": 360,
  "percentage": 30.7,
  "rank": 42,
  "percentile": 94.2,
  "total_questions": 90,
  "attempted": 78,
  "correct": 65,
  "incorrect": 13,
  "unattempted": 12,
  "accuracy_percentage": 83.3,
  "time_taken_seconds": 9240,
  "duration_seconds": 10800,
  "topper_score": 340,
  "average_score": 180
}
```

### GET /api/analysis/{attempt_id}/performance
```json
{
  "subjects": [{
    "name": "Physics",
    "score": 40,
    "max_score": 120,
    "percentage": 33.3,
    "topper_score": 115,
    "average_score": 60
  }]
}
```

### GET /api/analysis/{attempt_id}/time
```json
{
  "total_time_seconds": 9240,
  "avg_time_per_question_seconds": 118,
  "subjects": [{ "name": "Physics", "time_seconds": 3200 }],
  "difficulty": { "easy": 60, "medium": 120, "hard": 200 },
  "questions": [{ "question_id", "time_seconds", "difficulty", "result" }]
}
```

### GET /api/analysis/{attempt_id}/attempts
```json
{
  "correct": 65,
  "incorrect": 13,
  "skipped": 0,
  "unattempted": 12,
  "marked_for_review": 8,
  "net_score": 110.5,
  "gross_score": 260,
  "negative_marks": 13
}
```

### GET /api/analysis/{attempt_id}/difficulty
```json
{
  "easy":   { "total": 30, "correct": 27, "incorrect": 2, "unattempted": 1, "accuracy": 90 },
  "medium": { "total": 40, "correct": 28, "incorrect": 8, "unattempted": 4, "accuracy": 70 },
  "hard":   { "total": 20, "correct": 10, "incorrect": 3, "unattempted": 7, "accuracy": 50 }
}
```

### GET /api/analysis/{attempt_id}/subject-movement
```json
{
  "transitions": [
    { "from_subject": "Physics", "to_subject": "Chemistry", "at_question_number": 15, "at_time_seconds": 1800 }
  ],
  "time_in_subject": [{ "subject": "Physics", "total_seconds": 3200, "visit_count": 2 }]
}
```

### GET /api/analysis/{attempt_id}/question-journey
```json
{
  "events": [
    { "question_id", "question_number", "event": "visited", "timestamp_seconds": 0 },
    { "question_id", "question_number", "event": "answered", "timestamp_seconds": 45 },
    { "question_id", "question_number", "event": "marked_for_review", "timestamp_seconds": 90 },
    { "question_id", "question_number", "event": "revisited", "timestamp_seconds": 5400 },
    { "question_id", "question_number", "event": "answer_changed", "timestamp_seconds": 5460 }
  ]
}
```

### GET /api/analysis/{attempt_id}/question/{question_id}
```json
{
  "question_id": "uuid",
  "question_number": 12,
  "text": "...",
  "difficulty": "medium",
  "subject": "Physics",
  "topic": "Kinematics",
  "your_answer": "B",
  "correct_answer": "A",
  "is_correct": false,
  "time_spent_seconds": 95,
  "visit_count": 2,
  "change_count": 1,
  "is_marked_for_review": false,
  "explanation": "...",
  "options": [{ "option_key", "text", "is_correct", "selected": true/false }]
}
```

### GET /api/analysis/{attempt_id}/questions
Returns the full question-by-question table (all questions).
**Query**: `?subject_id=&result=correct|incorrect|skipped`
```json
{
  "questions": [{
    "question_id", "question_number", "subject", "topic", "difficulty",
    "your_answer", "correct_answer", "is_correct", "time_spent_seconds", "result"
  }]
}
```

---

## RAG Routes (`/api/rag`)

### POST /api/rag/upload
**Requires**: Role `teacher` or `admin`
**Content-Type**: `multipart/form-data`
**Body**: `file` (PDF or image)
**Response 202**: `{ document_id, filename, status: "pending" }`
Triggers async background processing (chunking + embedding).

### GET /api/rag/documents
**Requires**: Auth
**Response 200**: `DocumentOut[]` with `processing_status`

### GET /api/rag/documents/{document_id}
**Response 200**: `DocumentOut` with chunk count

### POST /api/rag/generate-questions
**Requires**: Role `teacher` or `admin`
**Body**:
```json
{
  "document_id": "uuid",
  "subject_id": "uuid",
  "topic_id": "uuid",
  "count": 10,
  "difficulty": "medium",
  "question_type": "mcq"
}
```
**Response 200**: `{ questions: GeneratedQuestion[] }` — not saved yet, for review
Each `GeneratedQuestion`: `{ text, explanation, options: [{ option_key, text, is_correct }] }`

### POST /api/rag/questions/save
**Requires**: Role `teacher` or `admin`
**Body**: `{ questions: GeneratedQuestion[], subject_id, topic_id, difficulty, document_id }`
**Response 201**: `{ saved_count, question_ids }`

### GET /api/rag/search
**Requires**: Auth
**Query**: `?q=newton%27s+law&document_id=&limit=5`
**Response 200**: `{ chunks: [{ content, document_name, page_number, score }] }`

---

## Pydantic Schema Files

| File | Schemas |
|---|---|
| `schemas/auth.py` | `RegisterIn`, `LoginIn`, `TokenOut`, `UserOut` |
| `schemas/exam.py` | `ExamCreate`, `ExamOut`, `SubjectCreate`, `SubjectOut` |
| `schemas/question.py` | `QuestionCreate`, `QuestionOut`, `OptionCreate`, `OptionOut` |
| `schemas/attempt.py` | `AttemptCreate`, `AttemptStateOut`, `AnswerUpdate`, `AttemptResultOut` |
| `schemas/analysis.py` | `OverviewOut`, `PerformanceOut`, `TimeOut`, `AttemptsOut`, `DifficultyOut`, `SubjectMovementOut`, `QuestionJourneyOut`, `QuestionDetailOut` |
| `schemas/rag.py` | `DocumentOut`, `GenerateQuestionsIn`, `GeneratedQuestion` |

---

## Error Responses

```json
{ "detail": "Not authenticated" }           // 401
{ "detail": "Forbidden" }                   // 403
{ "detail": "Exam not found" }              // 404
{ "detail": [{ "loc", "msg", "type" }] }   // 422 Validation
{ "detail": "Internal server error" }        // 500
```
