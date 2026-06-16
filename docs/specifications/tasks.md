# Tasks: QuizzerApp — Sequential Implementation Roadmap

**Input**: Specifications from `/docs/specifications/`  
**Prerequisites**: business-requirements.md, research.md, database-design.md, api-endpoints.md, contracts/api-spec.yaml, quickstart.md

---

## Execution Flow

```
1. Load technical-architecture.md
   → React 18 + Vite SPA, FastAPI + Mangum, Neon PostgreSQL + pgvector
   → Monorepo: frontend/ (TS) + backend/ (Python)
2. Load database-design.md
   → 14 tables: users, exams, subjects, topics, questions, options,
     test_papers, test_paper_questions, attempts, attempt_answers,
     attempt_subject_stats, leaderboard_cache, documents, document_chunks
3. Load api-endpoints.md
   → 40+ REST endpoints across auth, exams, questions, attempts, analysis, RAG
4. Load quickstart.md
   → 9 core user journeys as acceptance validation
5. Generate tasks by phase:
   → Phase 0 (Setup): T001–T005 — scaffold, config, tools
   → Phase 1 (Foundation): T006–T015 — models, auth, dashboard
   → Phase 2 (Exam Mgmt): T016–T026 — exam/question/test-paper CRUD
   → Phase 3 (Exam Taking): T027–T037 — attempt flow, exam UI
   → Phase 4 (Analysis): T038–T051 — 9 analytics + Recharts
   → Phase 5 (RAG/AI): T052–T059 — document processing + question generation
   → Phase 6 (Polish): T060–T067 — leaderboard, admin, E2E, deploy
6. Apply TDD rule: Pydantic schemas → contract tests → implementation → UI
7. SUCCESS: 67 tasks for complete platform
```

## Task Priority Legend

- **🔴 Phase 0–2** (Setup + Foundation + Exam Mgmt): Core platform — EXECUTE FIRST
- **🟡 Phase 3–4** (Exam Taking + Analysis): Student-facing MVP — EXECUTE SECOND
- **🟢 Phase 5–6** (RAG/AI + Polish): AI features + production readiness

## CRITICAL: Execute in Phase Order — Dependencies are Sequential

---

## ✅ PHASE 0: Scaffold & Configuration (Complete)

### Setup (Days 1–2)

- [x] **T001** 🔴 Monorepo scaffold — Vite React frontend + FastAPI backend
  - Paths: `frontend/` (Vite 5, React 18, TypeScript), `backend/` (FastAPI 0.115+)
  - Root: `vercel.json`, `docker-compose.yaml`, `.env.example`, `package.json`

- [x] **T002** 🔴 Install and configure core dependencies
  - Frontend: React 18, TypeScript 5.5, Vite 5, TanStack Query v5, Zustand v4, Axios, shadcn/ui, Recharts, react-hook-form, Zod
  - Backend: FastAPI, uvicorn, Mangum, SQLAlchemy 2.x, Alembic, asyncpg, pgvector, python-jose, passlib, pydantic[email]

- [x] **T003** 🔴 Configure development tools
  - Frontend: ESLint, TypeScript strict config, Tailwind 3.4, shadcn/ui init (`components.json`)
  - Backend: `pyproject.toml`, `uv` lockfile, ruff/black (optional)
  - Root: `.gitignore`, Docker compose

- [x] **T004** 🔴 Design PostgreSQL schema (14 tables)
  - Documented in `docs/specifications/database-design.md`
  - Enums: user_role, difficulty_level, attempt_status, doc_status
  - Extensions: uuid-ossp, pgvector

- [x] **T005** 🔴 Alembic initial migration
  - Path: `backend/app/db/migrations/versions/001_initial_schema.py`
  - Creates all 14 tables with indexes and constraints

---

## ✅ PHASE 1: Auth + DB Layer (Complete)

### Models & Auth (Days 3–6)

- [x] **T006** 🔴 SQLAlchemy async models
  - Paths: `backend/app/models/` — user.py, exam.py, question.py, test_paper.py, attempt.py, rag.py
  - Base: `UUIDMixin`, `TimestampMixin`

- [x] **T007** 🔴 Pydantic v2 schemas for auth
  - Path: `backend/app/schemas/auth.py`
  - Schemas: `RegisterIn`, `LoginIn`, `TokenOut`, `RefreshOut`, `UserOut`

- [x] **T008** 🔴 Auth service (JWT + bcrypt + refresh token rotation)
  - Path: `backend/app/services/auth_service.py`
  - Functions: `create_access_token`, `verify_token`, `hash_password`, `verify_password`, `create_refresh_token`, `rotate_refresh_token`

- [x] **T009** 🔴 Auth API routes
  - Path: `backend/app/api/routes/auth.py`
  - Routes: POST /register, POST /login, POST /refresh, POST /logout, GET /me
  - Deps: `get_current_user`, `require_role` in `deps.py`

- [x] **T010** 🔴 FastAPI app setup — CORS + Mangum
  - Path: `backend/app/main.py`
  - CORS origins from `config.py`, Mangum ASGI handler

- [x] **T011** 🔴 Frontend auth pages (Login + Register)
  - Paths: `frontend/src/pages/auth/Login.tsx`, `Register.tsx`
  - react-hook-form + Zod validation, calls `authApi.login()` / `.register()`

- [x] **T012** 🔴 Axios API client with 401 interceptor
  - Path: `frontend/src/services/api.ts`
  - Bearer token injection + auto-refresh on 401 + retry original request

- [x] **T013** 🔴 Zustand authStore
  - Path: `frontend/src/store/authStore.ts`
  - State: `{ user, isAuthenticated, accessToken, setUser, logout }`

- [x] **T014** 🔴 Frontend dashboard (basic)
  - Path: `frontend/src/pages/dashboard/Dashboard.tsx`
  - Shows: user name, role, email; Logout button; placeholder tiles for exam sections

- [x] **T015** 🔴 Docker compose local dev
  - Path: `docker-compose.yaml`
  - Services: PostgreSQL 16 + pgAdmin 4

### Password Reset — Forgot Password Flow (added 2026-06-14)

> Auth-domain follow-up to T007–T013. Numbered after the original 67-task roadmap
> (T068+) to avoid renumbering, but belongs to Phase 1 and can be executed now since
> the auth foundation is complete. Same TDD cycle: schema → contract test → route → UI.

**Plan / design**

```
Goal: a user who forgot their password can request a reset link by email and set a
      new password, without an authenticated session.

Flow:
  1. User clicks "Forgot password?" on /login → /forgot-password page.
  2. Submits email → POST /api/auth/forgot-password.
       - Always returns 202 (never reveal whether the email exists → no user enumeration).
       - If the email maps to an active user: generate a single-use reset token, store
         only its SHA-256 hash + 30-min expiry in a new password_reset_tokens table, and
         email a link: {FRONTEND_URL}/reset-password?token=<raw>.
  3. User opens link → /reset-password page (token read from query string).
  4. Submits new password (+ confirm) → POST /api/auth/reset-password { token, new_password }.
       - Validate token (exists, unexpired, unused) → 400 on failure.
       - Update users.hashed_password (bcrypt), mark token used, and revoke all of the
         user's active refresh tokens (force re-login everywhere).
       - 200 → frontend redirects to /login with a success toast.

Security notes:
  - Reuse the existing hash-the-token pattern from RefreshToken (store hash, send raw).
  - Reset token: secrets.token_urlsafe(48), 30-minute expiry, single use.
  - Email delivery via the Gmail MCP server (per CLAUDE.md MCP table); abstract behind a
    notification helper so it can be swapped for SMTP/SES later.
  - Rate-limit forgot-password later (out of scope here; note for Phase 6 polish).
```

- [x] **T068** 🔴 Password-reset DB + schemas + service
  - DB: add `password_reset_tokens` table (`id, user_id FK, token_hash, expires_at, used_at, created_at`) in `docs/specifications/database-design.md`; Alembic migration under `backend/app/db/migrations/versions/`
  - Model: `backend/app/models/user.py` → `PasswordResetToken`
  - Schemas: `backend/app/schemas/auth.py` → `ForgotPasswordIn { email }`, `ResetPasswordIn { token, new_password }`
  - Service: `backend/app/services/auth_service.py` → `create_password_reset(db, email)`, `reset_password(db, token, new_password)` (reuses hash-token + refresh-token revocation patterns)

- [x] **T069** 🔴 Contract tests for password-reset routes (RED)
  - Path: `backend/tests/contract/test_password_reset_api.py`
  - Tests: forgot-password returns 202 for known + unknown email (no enumeration); reset with valid token → 200 + new password logs in; expired/invalid/used token → 400; short new password → 422
  - Run FIRST, confirm they fail (routes not implemented)

- [x] **T070** 🔴 Password-reset API routes + email delivery (GREEN)
  - Path: `backend/app/api/routes/auth.py` (extend)
  - Routes: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
  - Email the reset link via Gmail MCP behind a small notification helper; make tests pass

- [x] **T071** 🔴 Frontend forgot/reset password pages
  - Paths: `frontend/src/pages/auth/ForgotPassword.tsx`, `frontend/src/pages/auth/ResetPassword.tsx`
  - Add "Forgot password?" link on `Login.tsx`; react-hook-form + Zod; calls `authApi.forgotPassword()` / `.resetPassword()`
  - Verify with the Playwright MCP server; persist `tests/playwright/password-reset.spec.ts`

---

## ✅ PHASE 2: Exam Management API + UI (Complete)

**TDD cycle for each domain**: Schemas → Contract Tests → Routes → Frontend

### Exam Domain Schemas (Day 7)

- [x] **T016** 🔴 Pydantic v2 schemas for exam domain
  - Path: `backend/app/schemas/exam.py`
  - Schemas: `ExamCreate`, `ExamUpdate`, `ExamOut`, `SubjectCreate`, `SubjectOut`, `TopicCreate`, `TopicOut`
  - Fields per spec: see `docs/specifications/api-endpoints.md`

- [x] **T017** 🔴 Pydantic v2 schemas for question domain
  - Path: `backend/app/schemas/question.py`
  - Schemas: `OptionCreate`, `OptionOut`, `QuestionCreate`, `QuestionUpdate`, `QuestionOut`
  - Note: `OptionCreate` includes `is_correct`; `OptionOut` omits it for student-facing responses

- [x] **T018** 🔴 Pydantic v2 schemas for test paper domain
  - Path: `backend/app/schemas/test_paper.py`
  - Schemas: `TestPaperCreate`, `TestPaperOut`, `TestPaperQuestionAdd`

### Exam Management API (Days 8–10)

- [x] **T019** 🔴 Contract tests for exam routes
  - Path: `backend/tests/contract/test_exam_api.py`
  - Tests: GET /api/exams (list + filter), POST /api/exams (201 created), GET /api/exams/{id}, PUT /api/exams/{id}
  - Run tests FIRST to confirm they fail; implement routes to make them pass

- [x] **T020** 🔴 Exam CRUD API routes
  - Path: `backend/app/api/routes/exams.py`
  - Routes: GET /api/exams, POST /api/exams, GET /api/exams/{id}, PUT /api/exams/{id}
  - Pagination: `?page=1&limit=20&exam_type=JEE&published=true`
  - Auth: all require auth; POST/PUT require teacher or admin role

- [x] **T021** 🔴 Subject and Topic API routes
  - Extend: `backend/app/api/routes/exams.py`
  - Routes: GET /api/exams/{id}/subjects, POST /api/exams/{id}/subjects
  - Response: `SubjectOut[]` with nested `topics: TopicOut[]`

### Question Bank API (Days 11–12)

- [x] **T022** 🔴 Contract tests for question routes
  - Path: `backend/tests/contract/test_question_api.py`
  - Tests: GET /api/questions (paginated + subject/difficulty filters), POST /api/questions
    (201 teacher, 403 student, 401 anon, 422 missing text / wrong option count, OptionOut
    omits is_correct), PUT /api/questions/{id} (200, 403, 404), DELETE /api/questions/{id}
    (204, 403, 404)
  - RED confirmed: 14 fail (routes 404), 2 pass (the nonexistent→404 cases). Green after T023.

- [x] **T023** 🔴 Question CRUD API routes
  - Path: `backend/app/api/routes/questions.py` + `backend/app/services/question_service.py`
  - Routes: GET /api/questions, POST /api/questions, PUT /api/questions/{id}, DELETE /api/questions/{id}
  - Filters: `?subject_id=&topic_id=&difficulty=&page=&limit=` (tags filter deferred — not in api-spec.yaml GET params)
  - POST/PUT/DELETE require teacher or admin; DELETE also validates ownership (creator or admin)
  - Options eager-loaded (lazy="raise"); `QuestionOut` omits `is_correct`. Router registered in
    `main.py` (T026 prereq). GREEN: all 16 T022 tests pass; full suite 58 passed, no regressions.

### Test Paper API (Days 13–14)

- [x] **T024** 🔴 Contract tests for test paper routes
  - Path: `backend/tests/contract/test_testpaper_api.py`
  - Tests: GET /api/exams/{id}/test-papers (401, empty [], 404 nonexistent exam), POST create
    (201 owner, 403 student, 401 anon, 422 missing duration, 404 nonexistent exam, round-trips
    into list), POST /api/test-papers/{id}/questions (200 {added: n}, 403 student, 401 anon,
    404 nonexistent paper)
  - RED confirmed: 10 fail (routes 404), 3 pass (the nonexistent→404 cases). Green after T025.

- [x] **T025** 🔴 Test paper API routes
  - Path: `backend/app/api/routes/exams.py` (nested) + `test_papers.py` + `services/test_paper_service.py`
  - Routes: GET /api/exams/{id}/test-papers, POST /api/exams/{id}/test-papers (in exams.py,
    alongside subjects), POST /api/test-papers/{id}/questions (own router; bulk add with marks)
  - Body wrapper `TestPaperQuestionsIn { question_ids: [TestPaperQuestionAdd] }`; created_at
    populated via refresh (server_default). GREEN: 13 T024 tests pass; full suite 71 passed.

- [x] **T026** 🔴 Register all Phase 2 routers in main.py
  - Path: `backend/app/main.py`
  - Done across T023/T025: `exams`, `questions`, and `test_papers` routers all registered.

### Teacher UI (Days 15–17)

> Built via the shadcn subagent pipeline (analyze → research → build). Shared foundation:
> data layer (`types/{exam,question,testPaper}.ts`, `services/*`, `hooks/use{Exams,Questions,TestPapers}.ts`),
> `components/teacher/{TeacherPageShell,DifficultyBadge}.tsx`, 15 shadcn primitives, `Toaster`
> + `TooltipProvider` in `App.tsx`, teacher console links on the Dashboard. Verified live with
> Playwright (`tests/playwright/teacher-ui.spec.ts`, 3 serial tests passing); `tsc --noEmit` clean.

- [x] **T027** 🔴 Exam management page (teacher)
  - Path: `frontend/src/pages/teacher/ExamsPage.tsx` (+ `CreateExamDialog`, `ExamCard`)
  - Exam cards (title, exam_type + published/draft badges), Create Exam dialog (title,
    description, exam_type), inline add-subject per card with subject chips.

- [x] **T028** 🔴 Question bank page (teacher)
  - Path: `frontend/src/pages/teacher/QuestionBankPage.tsx` (+ `QuestionFormDialog`, `DeleteQuestionDialog`)
  - Filter panel: exam→subject cascade, difficulty, search; table with DifficultyBadge,
    edit/delete; Add dialog with 4 options + correct-answer radio. Subject names resolved via
    `useSubjectNameMap` (no global subjects endpoint). Edit limited to text/difficulty/
    explanation/tags (options immutable per `QuestionUpdatePayload`).

- [x] **T029** 🔴 Test paper creation page (teacher)
  - Path: `frontend/src/pages/teacher/TestPaperPage.tsx` (+ `wizard/Step{Settings,SelectQuestions,Marks}`)
  - 3-step wizard with Progress indicator: settings (exam, duration min→sec, marks, shuffle
    Switches) → checkbox question selector (ScrollArea, select-all) → per-question marks table
    → create paper then bulk-add questions. Verified end-to-end (201 + 200 network calls).

---

## ✅ PHASE 3: Exam Taking (Complete)

### Attempt API (Days 18–20)

- [x] **T030** 🟡 Pydantic v2 schemas for attempt domain
  - Path: `backend/app/schemas/attempt.py`
  - Schemas: `AttemptCreate`, `AttemptStateOut` (+ `QuestionStudentOut`/`OptionStudentOut`/
    `TestPaperBrief`/`AnswerStateOut`), `AnswerUpdate`, `AttemptResultOut`, `AttemptSummaryOut`
  - `OptionStudentOut` omits `is_correct` (answer key never sent to clients).

- [x] **T031** 🟡 Contract tests for attempt routes
  - Path: `backend/tests/contract/test_attempt_api.py` (14 tests)
  - start (201/401/403 teacher/403 unpublished/409 duplicate), resume (200/403/404), answer
    (200 + persists/403), submit (correct scoring, negative marking, 400 re-submit), list.
  - RED→GREEN with T032–T034.

- [x] **T032** 🟡 Attempt start and resume API
  - Path: `backend/app/api/routes/attempts.py` + `services/attempt_service.py`
  - POST /api/attempts → AttemptStateOut (student only; 403 if parent exam unpublished;
    409 if already attempted). GET /api/attempts/{id} → resume with saved answers + elapsed.
  - Added `UniqueConstraint(user_id, test_paper_id)` to the Attempt model (matches migration 001).

- [x] **T033** 🟡 Answer auto-save API
  - Route: PUT /api/attempts/{id}/answer (owner only; 400 if not in_progress)
  - Upserts the `attempt_answers` row: selected_option_id, time_spent_seconds += delta,
    is_marked_for_review, visit_count, change_count, last_visited_at. Returns `{ saved: true }`.

- [x] **T034** 🟡 Attempt submit API
  - Route: POST /api/attempts/{id}/submit (owner; 400 if already submitted)
  - raw_score = Σ marks(correct); final_score = raw − Σ negative_marks(incorrect); writes
    `attempt_subject_stats` per subject; sets status/submitted_at; computes rank + percentile
    among submitted attempts. (Subject-stat computation lives in attempt_service for now;
    analysis_service refactor is T043.) GREEN: 14 tests; full suite 85 passed.
  - Updates: attempt.status = "submitted", attempt.submitted_at = now()
  - Returns: `AttemptResultOut` with rank + percentile

### Exam Session State (Day 21)

> Built via the shadcn subagent pipeline (analyze → build; no new components — all 19 already
> installed). Shared foundation I built directly: attempt data layer (`types/attempt.ts`,
> `services/attempts.ts`, `hooks/useAttempts.ts`) + the Zustand store (T035). Verified live with
> Playwright (`tests/playwright/exam-ui.spec.ts`, 3 serial tests passing); `tsc --noEmit` clean.
> Backend fix needed for the UI: Decimal score/marks fields now serialize as JSON numbers, and
> `AttemptSummaryOut` gained `test_paper_title` (committed separately).

- [x] **T035** 🟡 Zustand examSessionStore
  - Path: `frontend/src/store/examSessionStore.ts`
  - State `{ attemptId, testPaper, questions, currentIndex, localAnswers, markedForReview,
    timeElapsedSeconds, isPaused }`; actions `syncFromServer`, `setAnswer`, `markForReview`,
    `nextQuestion`, `prevQuestion`, `goToQuestion`, `tick`, `setPaused`, `reset`; persisted to
    sessionStorage. Helper `questionStatus()` for palette colour.

### Exam Interface UI (Days 22–25)

- [x] **T036** 🟡 Exam layout and routing
  - Path: `frontend/src/pages/exam/ExamPage.tsx` (route `/exam/:attemptId`)
  - `useAttempt` → `syncFromServer`; immersive layout; full-screen toggle; submit AlertDialog.
  - Gates the body until the store is synced to this attempt (prevents the timer racing an
    unloaded session). Redirects to `/attempts` on submit (analysis page lands in Phase 4).

- [x] **T037** 🟡 Question display component
  - Path: `frontend/src/components/exam/QuestionDisplay.tsx`
  - Question number/text/image, difficulty badge, 4-option RadioGroup; option select →
    optimistic `setAnswer` + `PUT /answer` with dwell time. Prev / Mark-for-review / Clear / Next.

- [x] **T038** 🟡 Question palette component
  - Path: `frontend/src/components/exam/QuestionPalette.tsx`
  - Numbered grid coloured by `questionStatus` (unanswered/answered/marked/answered-marked) +
    legend; click → `goToQuestion`.

- [x] **T039** 🟡 Exam timer component
  - Path: `frontend/src/components/exam/ExamTimer.tsx`
  - Owns its own 1s interval (only subscriber to `timeElapsedSeconds`); HH:MM:SS, red < 5 min;
    auto-submit on expiry (guarded so it never fires before the session loads). Redirect to
    `/attempts`.

- [x] **T040** 🟡 Attempt history page (student)
  - Path: `frontend/src/pages/student/AttemptsPage.tsx` (route `/attempts`; Dashboard link added)
  - Table: test paper title, date, status badge, score, rank, percentile; Resume (in-progress)
    or View Analysis link. Backend `AttemptSummaryOut.test_paper_title` added for the name.

---

## ✅ PHASE 4: Analysis (Weeks 5–6)

### Analysis API (Days 26–28)

- [x] **T041** 🟡 Pydantic v2 schemas for analysis (9 response types)
  - Path: `backend/app/schemas/analysis.py`
  - `OverviewOut`, `PerformanceOut`, `TimeOut`, `AttemptsBreakdownOut`, `DifficultyOut`,
    `SubjectMovementOut`, `QuestionJourneyOut`, `QuestionDetailOut`, `QuestionListOut` (+ nested
    item schemas). All money/score fields typed `float` → JSON numbers.

- [x] **T042** 🟡 Contract tests for analysis routes
  - Path: `backend/tests/contract/test_analysis_api.py` (14 tests)
  - All 9 sections + auth (401/403 other-student/200 paper-teacher/404); asserts numbers from a
    fixture attempt (1 correct / 1 wrong / 1 blank → score 3, accuracy 50%, difficulty buckets).

- [x] **T043** 🟡 Analysis service
  - Path: `backend/app/services/analysis_service.py`
  - `compute_subject_stats(db, attempt)` (idempotent) — now owns subject-stats; `submit_attempt`
    calls it. `authorize()` (owner/admin/paper-teacher). `load_context()` loads everything once;
    getters `get_overview`/`get_performance`/`get_time`/`get_attempts_breakdown`/`get_difficulty`/
    `get_subject_movement`/`get_question_journey`/`get_question_detail`/`get_question_list`.

- [x] **T044** 🟡 Analysis API routes
  - Path: `backend/app/api/routes/analysis.py` (registered in main.py)
  - All 9 `GET /api/analysis/{id}/…` endpoints via a `get_context` dependency (404/403 there).
  - GREEN: 14 T042 tests; full suite 99 passed, no regressions.

### Analysis Frontend — Layout + Overview (Day 29)

- [x] **T045** 🟡 Analysis page layout + navigation
  - Path: `frontend/src/pages/analysis/AnalysisPage.tsx`
  - Tabbed navigation: Overview | Performance | Time | Attempts | Difficulty | Subject Movement | Question Journey | Questions
  - Each tab lazy-loads its section component

- [x] **T046** 🟡 Overview section
  - Path: `frontend/src/components/analysis/OverviewSection.tsx`
  - KPI cards: Score, Max Score, Percentage, Rank, Percentile, Accuracy, Time Taken
  - Radial gauge chart (RadialBarChart from Recharts) for score percentage
  - Benchmark row: Your score | Topper score | Average score

### Analysis Frontend — Charts (Days 30–33)

- [x] **T047** 🟡 Performance section (subject breakdown)
  - Path: `frontend/src/components/analysis/PerformanceSection.tsx`
  - Grouped BarChart: X-axis = subjects, 3 bars each (your score, topper score, average)
  - Summary table below chart

- [x] **T048** 🟡 Time analysis section
  - Path: `frontend/src/components/analysis/TimeSection.tsx`
  - Histogram (BarChart): time buckets 0–30s, 30–60s, 1–2m, 2–5m, 5m+
  - PieChart: time per subject
  - Stats: total time, avg per question, time per difficulty level

- [x] **T049** 🟡 Attempts analysis section
  - Path: `frontend/src/components/analysis/AttemptsSection.tsx`
  - PieChart: correct | incorrect | skipped | unattempted | marked for review
  - Waterfall BarChart: gross_score → -negative_marks → net_score

- [x] **T050** 🟡 Difficulty breakdown section
  - Path: `frontend/src/components/analysis/DifficultySection.tsx`
  - Stacked BarChart: easy/medium/hard, each bar stacked: correct (green), incorrect (red), unattempted (grey)
  - Accuracy % label per difficulty level

- [x] **T051** 🟡 Subject movement section
  - Path: `frontend/src/components/analysis/SubjectMovementSection.tsx`
  - Custom CSS horizontal timeline showing subject transitions over exam duration
  - Each segment: subject name + color-coded, duration label

- [x] **T052** 🟡 Question journey section
  - Path: `frontend/src/components/analysis/QuestionJourneySection.tsx`
  - Vertical timeline: visited → answered → marked_for_review → revisited → answer_changed events
  - Each event shown with timestamp (elapsed time from exam start)

- [x] **T053** 🟡 Question-by-question table
  - Path: `frontend/src/components/analysis/QuestionsTableSection.tsx`
  - Filterable table: Q#, Subject, Topic, Difficulty, Your Answer, Correct Answer, Result (✅/❌/—), Time
  - Row click → opens question detail modal with full text + explanation

---

## 🟢 PHASE 5: RAG / AI Question Generation (Weeks 7–8)

### RAG API (Days 34–37)

- [x] **T054** 🟢 Pydantic v2 schemas for RAG domain
  - Path: `backend/app/schemas/rag.py`
  - Schemas: `DocumentOut`, `GenerateQuestionsIn`, `GeneratedQuestion`, `SaveQuestionsIn`, `SaveQuestionsOut`, `SearchResult`

- [x] **T055** 🟢 Contract tests for RAG routes
  - Path: `backend/tests/contract/test_rag_api.py`
  - Tests: POST /upload (202), GET /documents, GET /documents/{id}, POST /generate-questions, POST /questions/save, GET /search

- [x] **T056** 🟢 Document upload API + Vercel Blob storage
  - Path: `backend/app/api/routes/rag.py`
  - POST /api/rag/upload: validates file type + size (≤50MB), saves to Vercel Blob, creates document record, enqueues background task
  - Returns 202 { document_id, status: "pending" }

- [x] **T057** 🟢 RAG processing service
  - Path: `backend/app/services/rag_service.py`
  - `process_document(document_id)`: extract (pdfplumber → pytesseract fallback) → chunk (LangChain RecursiveCharacterTextSplitter, 500/50) → embed (OpenAI text-embedding-3-small, batch 100) → store pgvector → update status = "ready"
  - Background task via FastAPI `BackgroundTasks`

- [x] **T058** 🟢 Question generation API
  - Route: POST /api/rag/generate-questions
  - Embed query from subject/topic params → pgvector cosine search (top_k=15 chunks)
  - Call GPT-4o with structured prompt → Pydantic-validated `GeneratedQuestion` list
  - Returns questions WITHOUT saving (for teacher review)
  - Route: POST /api/rag/questions/save → bulk insert to questions + options tables

### RAG Frontend UI (Days 38–40)

- [x] **T059** 🟢 Document upload and status page (teacher)
  - Path: `frontend/src/pages/teacher/RAGPage.tsx`
  - File picker (PDF/image, max 50MB), upload button
  - Document list with status badges (pending/processing/ready/failed), polling every 3s

- [x] **T060** 🟢 Question generation form + review UI (teacher)
  - Path: `frontend/src/components/rag/GenerateQuestionsPanel.tsx`
  - Form: select document, subject, topic, difficulty, count (1–20)
  - Results panel: generated questions with correct answer highlighted (green)
  - Per-question: edit button (inline editing), delete button
  - "Save Approved" button → POST /api/rag/questions/save

---

## 🟢 PHASE 6: Leaderboard + Admin + Polish (Weeks 9–10)

- [ ] **T061** 🟢 Leaderboard computation on submit
  - Extend T034: after computing subject stats, update `leaderboard_cache`
  - Recalculate rank + percentile for all attempts on the same test_paper_id
  - Cache JSON: `[{ user_id, name, score, rank, percentile }]`

- [ ] **T062** 🟢 Leaderboard API route
  - Route: GET /api/test-papers/{id}/leaderboard
  - Returns cached leaderboard JSONB, or computes on-the-fly if cache missing

- [ ] **T063** 🟢 Leaderboard page UI
  - Path: `frontend/src/pages/student/LeaderboardPage.tsx`
  - Table: Rank | Name | Score | Percentile; current user's row highlighted

- [ ] **T064** 🟢 Admin dashboard
  - Path: `frontend/src/pages/admin/AdminDashboard.tsx`
  - User management: list users, toggle is_active, filter by role
  - Exam management: toggle is_published on any exam

- [ ] **T065** 🟢 E2E tests — auth flow (Playwright)
  - Path: `tests/playwright/auth.spec.ts`
  - Tests: register → login → view dashboard → logout → verify redirect to /login

- [ ] **T066** 🟢 E2E tests — exam flow (Playwright)
  - Path: `tests/playwright/exam.spec.ts`
  - Tests: start exam → answer 3 questions → verify auto-save → submit → verify redirect to analysis

- [ ] **T067** 🟢 E2E tests — analysis view (Playwright)
  - Path: `tests/playwright/analysis.spec.ts`
  - Tests: post-submit navigate to overview → click each tab → verify charts render → click question row → verify detail modal

---

## Progress Summary

| Phase | Total | Done | Remaining |
|---|---|---|---|
| Phase 0: Scaffold | 5 | 5 ✅ | 0 |
| Phase 1: Auth + DB | 10 | 10 ✅ | 0 |
| Phase 1b: Password Reset | 4 | 4 ✅ | 0 |
| Phase 2: Exam Mgmt | 14 | 14 ✅ | 0 |
| Phase 3: Exam Taking | 11 | 11 ✅ | 0 |
| Phase 4: Analysis | 13 | 13 | 0 |
| Phase 5: RAG/AI | 7 | 7 | 0 |
| Phase 6: Polish | 7 | 0 | 7 |
| **Total** | **71** | **55** | **16** |

**Current**: 55/71 tasks complete (77%) — Phase 5 RAG/AI complete  
**Next task**: T061 — Leaderboard computation on submit

---

## Quality Gates Per Task

Every task requires:
1. Code written and linted (no TypeScript/Python type errors)
2. Contract test passes (for backend tasks) OR manual UI verification (for frontend)
3. Task checkbox updated in this file `[ ]` → `[x]`
4. No regressions in previously passing tests

## Backend Task Template

```
Task: T0XX — [description]
1. Write/update Pydantic schemas in backend/app/schemas/
2. Write contract test in backend/tests/contract/
3. Run test → confirm FAIL (expected — not implemented yet)
4. Implement route/service
5. Run test → confirm PASS
6. Manually test via FastAPI /docs UI
7. Mark [x] in tasks.md
```

## Frontend Task Template

```
Task: T0XX — [description]
1. Create component/page file
2. Wire TanStack Query hook for data fetching
3. Update Zustand store if local state needed
4. Run dev server, navigate to the route
5. Verify happy path and error states
6. Mark [x] in tasks.md
```
