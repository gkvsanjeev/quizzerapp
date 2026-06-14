# Quickstart Guide — QuizzerApp

**Last Updated**: 2026-06-14  
**Purpose**: End-to-end validation of core user journeys

---

## Prerequisites

- Node.js 20+, Python 3.12+, `uv` package manager
- PostgreSQL 16 with pgvector extension (or Neon free tier)
- OpenAI API key (for RAG embeddings)
- Anthropic API key (for question generation, optional — falls back to OpenAI)

---

## Development Setup

### 1. Environment Configuration

```bash
# Clone repository
git clone <repo-url> && cd QuizzerApp

# Backend environment
cp backend/.env.example backend/.env
# Fill in: DATABASE_URL, SECRET_KEY, OPENAI_API_KEY, VERCEL_BLOB_READ_WRITE_TOKEN

# Frontend environment
echo "VITE_API_BASE_URL=http://localhost:8000" > frontend/.env
```

**Required backend `.env` variables**:
```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/quizzerapp
SECRET_KEY=your-jwt-secret-key-minimum-32-characters
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...      # optional, for Claude generation
VERCEL_BLOB_READ_WRITE_TOKEN=...  # or set AWS S3 vars
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
```

### 2. Database Setup

```bash
# Option A: Local PostgreSQL (requires pgvector)
createdb quizzerapp
psql quizzerapp -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Option B: Neon free tier (recommended)
# Create project at neon.tech → copy DATABASE_URL → paste into backend/.env

# Run migrations
cd backend && uv sync
uv run alembic upgrade head
```

### 3. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install && npm run dev    # http://localhost:5173

# Or: Local PostgreSQL + pgAdmin via Docker
docker compose up -d
```

---

## Core User Journeys

### Journey 1 — New Student Registration

**Trigger**: User visits the app for the first time  
**Validation**: Account created, JWT tokens issued, redirected to dashboard

```
1. Navigate to /register
2. Enter name, email, password (min 8 chars)
3. Submit → POST /api/auth/register
4. Expect: 201 response with { user, access_token }
5. Expect: httpOnly refresh_token cookie set
6. Expect: Redirect to /dashboard
7. Verify: Dashboard shows user's name and role = "student"
```

---

### Journey 2 — Student Logs In and Sees Available Tests

**Trigger**: Returning student visits the app  
**Validation**: Login works, dashboard shows published test papers

```
1. Navigate to /login
2. Enter email + password → POST /api/auth/login
3. Expect: access_token in response, refresh_token cookie set
4. Navigate to /dashboard → GET /api/exams?published=true
5. Expect: List of published test papers with title, duration, subject count
```

---

### Journey 3 — Student Takes a Timed Exam

**Trigger**: Student clicks "Start Test" on a published test paper  
**Validation**: Exam starts, questions load, answers save, timer counts down

```
1. Click "Start Test" → POST /api/attempts { test_paper_id }
2. Expect: AttemptStateOut with all questions (text + options, no is_correct)
3. Exam interface loads in full-screen with:
   - Countdown timer (e.g., 3:00:00 for JEE)
   - Question text + 4 radio options
   - Question palette grid (all numbers shown)
4. Select option A on question 1
   → PUT /api/attempts/{id}/answer { question_id, selected_option_id, time_spent_delta_seconds: 45 }
   → Expect: { saved: true }
5. Navigate to question 5, mark for review
   → PUT /api/attempts/{id}/answer { question_id, is_marked_for_review: true }
6. Verify: Question palette shows Q1 as "answered", Q5 as "marked for review"
7. Auto-save fires every 10 seconds (verify network tab)
```

---

### Journey 4 — Exam Resume After Browser Close

**Trigger**: Student closes browser mid-exam, reopens  
**Validation**: Exam resumes with saved answers and correct remaining time

```
1. Start an exam (Journey 3 steps 1–4)
2. Answer 5 questions, spend 10 minutes
3. Close browser tab / navigate away
4. Reopen app → navigate to /exam/{attempt_id}
5. GET /api/attempts/{attempt_id}
6. Expect: AttemptStateOut with:
   - Previously answered questions pre-filled
   - time_elapsed_seconds ≈ 600 (10 minutes)
   - Timer resumes from correct remaining time
```

---

### Journey 5 — Exam Auto-Submit on Timer Expiry

**Trigger**: Exam timer reaches 00:00:00  
**Validation**: Automatic submission, redirect to analysis

```
1. Start a 1-minute test exam (for testing purposes)
2. Answer some questions
3. Let timer expire
4. Expect: Frontend automatically calls POST /api/attempts/{id}/submit
5. Expect: Redirect to /analysis/{attempt_id}
6. Expect: attempt.status = "timed_out" in DB
```

---

### Journey 6 — Student Views Post-Exam Analysis

**Trigger**: Exam is submitted (manually or by timer)  
**Validation**: All 8 analysis sections load with correct data

```
1. Submit exam → redirect to /analysis/{attempt_id}
2. Verify Overview section:
   - GET /api/analysis/{id}/overview
   - Shows: score, max_score, percentage, rank, percentile
   - Shows: correct, incorrect, unattempted, accuracy_percentage
3. Navigate to Performance tab:
   - GET /api/analysis/{id}/performance
   - Bar chart shows each subject's score vs max vs topper
4. Navigate to Time tab:
   - GET /api/analysis/{id}/time
   - Histogram of time per question; pie chart of time per subject
5. Navigate to Difficulty tab:
   - GET /api/analysis/{id}/difficulty
   - Stacked bar: easy/medium/hard with correct/incorrect/unattempted breakdown
6. Navigate to Question-by-Question tab:
   - GET /api/analysis/{id}/questions
   - Table: question number, your answer, correct answer, result, time spent
7. Click a row → Question detail modal:
   - GET /api/analysis/{id}/question/{question_id}
   - Shows: full question text, your answer highlighted (red/green), explanation
```

---

### Journey 7 — Teacher Creates an Exam and Question Bank

**Trigger**: Teacher logs in and sets up a new exam  
**Validation**: Exam created, subjects added, questions added

```
1. Login as teacher
2. Navigate to /teacher/exams → POST /api/exams { title: "JEE Mock 1", exam_type: "JEE" }
3. Add subjects:
   - POST /api/exams/{id}/subjects { name: "Physics", order_index: 1 }
   - POST /api/exams/{id}/subjects { name: "Chemistry", order_index: 2 }
4. Add a question manually:
   - POST /api/questions {
       subject_id, text: "Newton's 2nd law states...",
       difficulty: "medium",
       options: [{ option_key: "A", text: "F=ma", is_correct: true }, ...]
     }
5. Verify: Question appears in GET /api/questions?subject_id={id}
```

---

### Journey 8 — Teacher Uses RAG to Generate Questions from PDF

**Trigger**: Teacher uploads exam material PDF, generates MCQs  
**Validation**: Document processed, questions generated and saved

```
1. Upload PDF:
   - POST /api/rag/upload (multipart/form-data, file = textbook.pdf)
   - Expect: 202 { document_id, status: "pending" }
2. Poll until ready:
   - GET /api/rag/documents/{document_id}
   - Expect: status changes pending → processing → ready
3. Generate questions:
   - POST /api/rag/generate-questions {
       document_id, subject_id, topic_id,
       count: 5, difficulty: "medium"
     }
   - Expect: { questions: [ { text, explanation, options: [...] } ] }
4. Review generated questions (not yet saved)
5. Edit one question text (client-side)
6. Delete one question (client-side)
7. Save approved questions:
   - POST /api/rag/questions/save { questions: [...approved...], subject_id, difficulty }
   - Expect: { saved_count: 4, question_ids: [...] }
8. Verify: Questions appear in GET /api/questions?subject_id={id} with source_doc_id set
```

---

### Journey 9 — Admin Publishes Test Paper and Views Leaderboard

**Trigger**: Admin reviews a test paper and publishes it; views rankings  
**Validation**: Test paper becomes visible to students; leaderboard shows after first submit

```
1. Login as admin
2. View test paper:
   - GET /api/exams/{id}/test-papers
   - Confirm paper is is_published = false
3. Publish:
   - PUT /api/exams/{id} { is_published: true }
   - Verify: Students can now see it on their dashboard
4. After a student submits an attempt:
   - Admin views leaderboard
   - Expect: [{user_id, name, score, rank, percentile}] sorted by score desc
```

---

## Smoke Test Checklist

Run these after any deployment to verify core functionality:

```bash
# Auth smoke tests
curl -X POST /api/auth/register -d '{"email":"test@x.com","name":"Test","password":"test1234"}'
# Expect: 201 with access_token

curl -X POST /api/auth/login -d '{"email":"test@x.com","password":"test1234"}'
# Expect: 200 with access_token

curl -H "Authorization: Bearer $TOKEN" /api/auth/me
# Expect: 200 with user object

# Exam smoke test (requires teacher role)
curl -X POST -H "Authorization: Bearer $TOKEN" /api/exams -d '{"title":"Smoke Test","exam_type":"Custom"}'
# Expect: 201 with exam object
```
