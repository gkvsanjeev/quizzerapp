# Technical Architecture — QuizzerApp

**Branch**: `main` | **Last Updated**: 2026-06-14  
**Input**: `docs/specifications/business-requirements.md`

---

## Execution Flow (/plan scope)

```
1. Load business-requirements.md
   → Detected: exam platform for JEE/NEET/UPSC students
   → Users: student (exam taker), teacher (content creator), admin (platform manager)
   → Key features: exam taking, analytics, RAG question generation
2. Fill Technical Context
   → Type: web SPA + REST API
   → Frontend: React 18 SPA (Vite), no SSR needed (exam UI is session-stateful)
   → Backend: Python FastAPI (RAG pipeline is Python-native)
3. Constitution Check
   → Projects: 2 (frontend, backend) ✓
   → Single data model (PostgreSQL + SQLAlchemy as source of truth) ✓
   → Direct API usage (no abstraction layers over FastAPI/SQLAlchemy) ✓
4. Phase 0 → research.md (complete — see docs/specifications/research.md)
5. Phase 1 → database-design.md, api-endpoints.md, quickstart.md (complete)
6. Phase 2 → tasks.md generated (67 tasks, 15 complete)
7. STOP — ready for implementation via tasks.md
```

---

## Summary

QuizzerApp is a web-based exam test series platform for competitive exam preparation. Core workflow:

1. **Teachers** create exams → subjects → topics → question banks → test papers
2. **Students** take timed mock tests in a CBT-style interface and receive 9-section analytics
3. **AI pipeline** generates questions from uploaded PDFs via LangChain + pgvector + LLM
4. Deployed as a Vercel monorepo: static React SPA + Python FastAPI serverless function + Neon PostgreSQL

---

## Technical Context

| Aspect | Decision |
|---|---|
| Language/Version | TypeScript (React 18 + Vite 5), Python 3.12 (FastAPI 0.115+) |
| Primary Dependencies | React, Zustand, TanStack Query, Recharts, FastAPI, SQLAlchemy 2.x, Alembic, pgvector, LangChain |
| Storage | Neon Serverless PostgreSQL 16 + pgvector, Vercel Blob (documents) |
| Auth | JWT (15min) + httpOnly refresh token (7 days, hashed in DB) |
| Testing | pytest (backend contract tests), Playwright (E2E) |
| Platform | Web SPA; Vercel monorepo hosting |
| Performance Goals | API < 200ms (p95), Exam UI zero-lag answer selection, Analysis < 2s |
| Constraints | No SSR (exam is stateful); Python required for RAG pipeline |
| Scale | Single-region; pgvector fine to ~100k doc chunks |

---

## Constitution Check

**Simplicity**:
- Projects: 2 (frontend React SPA + backend Python FastAPI) ✓
- Using frameworks directly? ✓ (no custom abstraction over FastAPI/SQLAlchemy)
- Single data model? ✓ (Alembic + SQLAlchemy = source of truth; Pydantic validates in/out)
- Avoiding premature patterns? ✓ (no microservices, no event bus, no background workers beyond FastAPI BackgroundTasks)

**Architecture**:
- Frontend only calls backend via REST (Axios with Bearer token)
- Backend is thin routes + services; no domain layer
- DB access only through SQLAlchemy ORM (no raw SQL except pgvector cosine query)
- Auth: stateless JWT + stateful refresh token (one DB lookup per refresh)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel CDN                                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  React SPA (frontend/dist/)                            │  │
│  │  Vite + React 18 + TypeScript                         │  │
│  │  TanStack Query (server state)                         │  │
│  │  Zustand (exam session state)                          │  │
│  │  Recharts (9 analysis visualizations)                  │  │
│  └──────────────────┬─────────────────────────────────────┘  │
│                     │ REST /api/*                             │
│  ┌──────────────────▼─────────────────────────────────────┐  │
│  │  Python FastAPI (backend/app/main.py)                  │  │
│  │  Mangum (ASGI → Vercel Lambda adapter)                 │  │
│  │  Routes: auth, exams, questions, attempts, analysis,   │  │
│  │          rag                                           │  │
│  │  Services: auth_service, analysis_service, rag_service  │  │
│  └──────────────────┬─────────────────────────────────────┘  │
│                     │                                         │
└─────────────────────│─────────────────────────────────────────┘
                      │ async SQLAlchemy 2.x
         ┌────────────▼────────────┐   ┌──────────────────────┐
         │  Neon Serverless        │   │  Vercel Blob / S3    │
         │  PostgreSQL 16          │   │  (PDF/image storage) │
         │  + pgvector extension   │   └──────────────────────┘
         │  14 tables              │
         │  1536-dim embeddings    │
         └─────────────────────────┘
```

---

## Key Design Decisions

### 1. SPA Over SSR
The exam interface has persistent state (timer, current question, answers) that must survive network calls. SSR page refreshes would destroy this state. A SPA with `sessionStorage` persistence (via Zustand) handles browser refresh gracefully.

### 2. Python Backend for RAG
LangChain, pdfplumber, pytesseract, and the OpenAI/Anthropic SDKs are Python-native. A JavaScript backend would require fragile native bindings for OCR. Python FastAPI is the natural fit.

### 3. Monorepo on Vercel
Single `vercel.json` deploys frontend as static files and backend as a Python Lambda. Same domain → no CORS complexity in production. One deploy pipeline for both.

### 4. pgvector Over Dedicated Vector DB
For <100k document chunks (realistic corpus for a single exam platform), pgvector with cosine similarity is fast enough. Keeping embeddings in PostgreSQL eliminates a second service and any sync issues between the relational store and vector index.

### 5. Analysis Computed on Submit
`attempt_subject_stats` is computed synchronously on submit (small aggregate, fast). Complex analyses (question journey, subject movement) run on-the-fly from `attempt_answers` — acceptable latency for 90 questions. `leaderboard_cache` is recomputed on each submit to keep rank/percentile fresh.

---

## Exam State Machine

```
┌─────────────┐   POST /api/attempts   ┌─────────────┐
│ not_started │ ─────────────────────► │ in_progress │
└─────────────┘                        └──────┬──────┘
                                              │
                              ┌───────────────┴──────────────┐
                              │                              │
                    POST /submit (manual)          timer expires (frontend)
                              │                              │
                              ▼                              ▼
                        ┌──────────┐                ┌────────────┐
                        │submitted │                │ timed_out  │
                        └──────────┘                └────────────┘
```

On submit (either path):
1. Compute `raw_score` = sum(marks for correct answers)
2. Compute `final_score` = raw_score - sum(negative_marks for incorrect answers)
3. Compute `attempt_subject_stats` per subject
4. Update `leaderboard_cache`, recompute rank + percentile for all attempts on this paper
5. Return `AttemptResultOut` to frontend → redirect to `/analysis/{attempt_id}`

---

## Frontend Architecture

```
frontend/src/
├── pages/               # Route-level components (own data-fetching via TQ hooks)
│   ├── auth/            # Login, Register
│   ├── dashboard/       # Student dashboard, Teacher dashboard
│   ├── exam/            # ExamPage (full-screen timer + question interface)
│   ├── analysis/        # AnalysisPage (8 tabbed sections)
│   ├── teacher/         # ExamsPage, QuestionBankPage, TestPaperPage, RAGPage
│   ├── student/         # AttemptsPage, LeaderboardPage
│   └── admin/           # AdminDashboard
├── components/
│   ├── ui/              # shadcn/ui primitives (Button, Card, Input, etc.)
│   ├── exam/            # QuestionDisplay, QuestionPalette, ExamTimer
│   ├── analysis/        # Section components (OverviewSection, PerformanceSection, ...)
│   └── rag/             # GenerateQuestionsPanel, DocumentStatusCard
├── hooks/               # TanStack Query wrappers (useExam, useAnalysis, useAuth, useRAG)
├── store/               # Zustand: authStore, examSessionStore
├── services/            # Axios client (api.ts), typed API functions (auth.ts, exam.ts, ...)
└── types/               # TypeScript interfaces (auth.ts, exam.ts, attempt.ts, analysis.ts)
```

### Data Flow

```
Page mount
  → TanStack Query hook (useQuery / useMutation)
    → services/ function (Axios call)
      → FastAPI endpoint
        → SQLAlchemy query
          → PostgreSQL
        ← JSON response (Pydantic schema)
      ← typed TypeScript object
    ← cached in TQ; re-fetched on stale
  ← rendered by component

Exam session (in-exam only)
  → Answer click → examSessionStore.setAnswer() (synchronous, optimistic)
  → Axios PUT /api/attempts/{id}/answer (async, fires and forgets with retry)
  → Timer tick → examSessionStore time += 1 (synchronous, Zustand interval)
```

---

## Backend Architecture

```
backend/app/
├── main.py              # FastAPI app, CORS, router registration, Mangum handler
├── config.py            # Pydantic Settings (reads .env)
├── api/
│   ├── deps.py          # get_db(), get_current_user(), require_role()
│   └── routes/          # One file per domain (auth, exams, questions, attempts, analysis, rag)
├── models/              # SQLAlchemy ORM models (source of truth for DB schema)
├── schemas/             # Pydantic v2 request/response schemas
├── services/            # Business logic (auth_service, analysis_service, rag_service)
└── db/
    ├── session.py       # Async Neon connection pool
    └── migrations/      # Alembic versions
```

### Request Lifecycle

```
HTTP request → vercel.json routes to backend/app/main.py
  → Mangum ASGI adapter translates Lambda event
    → FastAPI middleware (CORS, request logging)
      → Route handler (thin — validates auth, calls service)
        → Service function (business logic, DB queries via SQLAlchemy)
          → Pydantic schema validates and serializes response
        ← JSON response
```

---

## Security Model

| Concern | Implementation |
|---|---|
| Authentication | JWT (15min) verified on every request via `get_current_user` dep |
| Authorization | `require_role("teacher", "admin")` decorator on write routes |
| XSS Protection | Refresh tokens in httpOnly cookie (JS cannot read) |
| Token Revocation | Refresh tokens hashed and stored in DB; `revoked_at` set on logout |
| Input Validation | Pydantic v2 on all request bodies; FastAPI auto-rejects malformed JSON |
| SQL Injection | SQLAlchemy ORM parameterizes all queries; no raw SQL |
| CORS | Configured origin allowlist; credentials allowed only for same-origin in production |

---

## Phase Roadmap

| Phase | Weeks | Focus | Tasks |
|---|---|---|---|
| 0: Scaffold | 1 | Monorepo, tools, schema | T001–T005 ✅ |
| 1: Foundation | 1–2 | Auth, models, dashboard | T006–T015 ✅ |
| 2: Exam Management | 3–4 | CRUD APIs + teacher UI | T016–T029 |
| 3: Exam Taking | 5–6 | Attempt flow + exam UI | T030–T040 |
| 4: Analysis | 7–8 | 9 analytics + charts | T041–T053 |
| 5: RAG/AI | 9–10 | Document processing + generation | T054–T060 |
| 6: Polish | 11–12 | Leaderboard, admin, E2E, deploy | T061–T067 |
