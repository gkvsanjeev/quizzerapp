# QuizzerApp — Claude Code Context

## Project Purpose
Full-stack exam test series platform for competitive exam preparation (JEE, NEET, UPSC, GATE, etc.).
Students take timed mock tests in a real exam interface and receive deep analytics afterward.
Teachers/admins create question banks and test papers, optionally using AI-assisted RAG to generate questions from uploaded PDFs/images.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + Vite + TypeScript | React 18, Vite 5 |
| Styling | Tailwind CSS + shadcn/ui | Tailwind 3 |
| Charts | Recharts | 2.x |
| State | TanStack Query + Zustand | TQ v5, Zustand v4 |
| Backend | Python FastAPI | 0.115.x |
| ORM | SQLAlchemy 2.x + Alembic | async-first |
| Auth | JWT (access 15min) + refresh tokens (7 days) | bcrypt |
| Database | Neon Serverless PostgreSQL + pgvector | pg 16 |
| RAG | LangChain + pgvector + OpenAI Embeddings | text-embedding-3-small |
| OCR/PDF | pdfplumber + pytesseract | |
| Deployment | Vercel (monorepo) + Neon DB | |

---

## Directory Structure

```
QuizzerApp/
├── CLAUDE.md                    ← YOU ARE HERE
├── docs/
│   ├── DATABASE.md              ← Full PostgreSQL schema (DDL + descriptions)
│   ├── API.md                   ← REST API specification
│   ├── RAG.md                   ← RAG pipeline design
│   └── ARCHITECTURE.md          ← Architecture decisions + ADRs
├── .claude/
│   ├── commands/
│   │   ├── add-question.md      ← /add-question command
│   │   ├── generate-test.md     ← /generate-test command
│   │   ├── run-migrations.md    ← /run-migrations command
│   │   └── seed-data.md         ← /seed-data command
│   └── skills/
│       ├── api-patterns.md      ← FastAPI conventions for this project
│       └── react-patterns.md    ← React conventions for this project
├── frontend/                    ← React + Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/            ← Login, Register, ForgotPassword
│   │   │   ├── dashboard/       ← Role-specific dashboards
│   │   │   ├── exam/            ← Real exam interface (full-screen)
│   │   │   └── analysis/        ← 9 analytics sections post-exam
│   │   ├── components/
│   │   │   ├── ui/              ← shadcn/ui primitives
│   │   │   ├── charts/          ← Recharts wrappers per analysis type
│   │   │   ├── exam/            ← Timer, QuestionPalette, OptionCard
│   │   │   └── analysis/        ← OverviewCard, PerformanceChart, etc.
│   │   ├── hooks/               ← useExam, useAnalysis, useAuth, useRAG
│   │   ├── store/               ← Zustand: examSessionStore, authStore
│   │   ├── services/            ← axios API client + TanStack Query hooks
│   │   └── types/               ← Shared TypeScript interfaces
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                     ← Python FastAPI application
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py      ← /api/auth/*
│   │   │   │   ├── exams.py     ← /api/exams/*
│   │   │   │   ├── questions.py ← /api/questions/*
│   │   │   │   ├── attempts.py  ← /api/attempts/*
│   │   │   │   ├── analysis.py  ← /api/analysis/*
│   │   │   │   └── rag.py       ← /api/rag/*
│   │   │   └── deps.py          ← get_current_user, get_db
│   │   ├── models/              ← SQLAlchemy ORM models (one file per domain)
│   │   ├── schemas/             ← Pydantic v2 request/response schemas
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── analysis_service.py  ← Computes all 9 analysis datasets
│   │   │   └── rag_service.py
│   │   ├── db/
│   │   │   ├── session.py       ← Neon async connection pool
│   │   │   └── migrations/      ← Alembic versions
│   │   └── main.py              ← FastAPI app entry + Mangum handler
│   ├── pyproject.toml
│   └── requirements.txt
├── vercel.json                  ← Monorepo deployment config
└── package.json                 ← Root npm workspace
```

---

## Local Development

### Prerequisites
- Node.js 20+, Python 3.12+, `uv` (Python package manager)
- PostgreSQL 16 with pgvector extension (or Neon free tier)
- Set environment variables (copy `.env.example` → `.env`)

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
```

### Backend
```bash
cd backend
uv sync              # install deps from pyproject.toml
uv run alembic upgrade head          # apply migrations
uv run uvicorn app.main:app --reload # http://localhost:8000
```

### Database (local)
```bash
# Neon free tier recommended — set DATABASE_URL in .env
# Or local: createdb quizzerapp && psql quizzerapp -c "CREATE EXTENSION vector;"
```

---

## Environment Variables

```
# backend/.env
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
SECRET_KEY=your-jwt-secret-key-min-32-chars
OPENAI_API_KEY=sk-...
VERCEL_BLOB_READ_WRITE_TOKEN=...

# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

---

## Auth Flow

1. `POST /api/auth/register` → creates user, returns tokens
2. `POST /api/auth/login` → validates credentials, returns `access_token` (15min JWT) + `refresh_token` (7-day, httpOnly cookie)
3. Frontend stores `access_token` in memory (not localStorage), `refresh_token` in httpOnly cookie
4. On 401: automatically call `POST /api/auth/refresh` to rotate tokens
5. `POST /api/auth/logout` → revokes refresh token in DB

Roles: `admin` > `teacher` > `student`. Decorators: `require_role("teacher")` in `deps.py`.

---

## Coding Conventions

### TypeScript (Frontend)
- No `any` — use explicit types or `unknown`
- All API responses typed via `types/` interfaces
- TanStack Query for all server state; Zustand only for local UI state (exam session)
- Components under `components/` are pure/presentational; pages own data-fetching logic

### Python (Backend)
- Pydantic v2 models for all schemas (use `model_config = ConfigDict(from_attributes=True)`)
- All DB operations async (`async with session.begin()`)
- No raw SQL — use SQLAlchemy ORM or `select()` statements
- Route handlers are thin; business logic in `services/`
- All routes prefix with `/api`

---

## Key Patterns

### Exam State Machine
```
not_started → in_progress → submitted | timed_out
```
State stored in `attempts` table. On page refresh, frontend calls `GET /api/attempts/{id}` to resume.

### Analysis Data Flow
1. Attempt submitted → `analysis_service.compute_subject_stats(attempt_id)` runs
2. Results saved to `attempt_subject_stats` table
3. Complex queries (question journey, subject movement) computed on-the-fly from `attempt_answers`

### RAG Question Generation
See `docs/RAG.md` for full pipeline. Entry point: `POST /api/rag/generate-questions`.

---

## MCP Servers Available

| Server | Use |
|---|---|
| Playwright | E2E browser testing — use for verifying exam UI flows |
| Gmail | Sending exam result notifications |
| Google Calendar | Scheduling test paper release dates |

---

## Spec-Driven Development

This project follows a spec-driven approach. Always read the relevant spec before implementing.

### Spec Files (read these before coding)

| What | File |
|---|---|
| **Current task** → what to build next | `docs/specifications/tasks.md` |
| Business requirements (WHAT, not HOW) | `docs/specifications/business-requirements.md` |
| System architecture + design decisions | `docs/specifications/technical-architecture.md` |
| Technology research + ADRs | `docs/specifications/research.md` |
| Database schema (14 tables, DDL) | `docs/specifications/database-design.md` |
| REST API reference (all 40+ endpoints) | `docs/specifications/api-endpoints.md` |
| OpenAPI 3.0 spec (contract testing) | `docs/specifications/contracts/api-spec.yaml` |
| User journeys for validation | `docs/specifications/quickstart.md` |
| RAG pipeline design | `docs/specifications/rag-pipeline.md` |
| Contract test guide | `docs/specifications/contracts/README.md` |
| Dev setup + commands + conventions | `docs/development/README.md` |
| Task workflow + contribution rules | `docs/guides/contributing.md` |

### Implementation Order

```
Check tasks.md → find next [ ] task → read linked spec → follow task template
Backend: schema → contract test (RED) → implementation (GREEN) → mark [x]
Frontend: create file → wire TQ hook → manual verify → mark [x]
```

### Session Naming Convention

Before starting a new task, name the session after that task so the conversation
history stays searchable per task. `/rename` is a built-in Claude Code command that
only the user can run, so Claude must **proactively suggest the rename command** as the
first step of each new task and wait for the user to run it.

Format: `/rename QuizzerApp <Phase> — <Task Description> (<TaskID>)`
Example: `/rename QuizzerApp Phase 2 — Exam Domain Schemas (T016)`

### Per-Task Git Workflow

Every task is done on its own branch and pushed when complete. Steps:

```
1. Branch:  git checkout -b feature/<TaskID>-<slug>     (e.g. feature/T016-exam-schemas)
            Branch naming follows docs/guides/contributing.md → Git Conventions.
2. Implement + test (see Per-Task Testing below).
3. Commit:  git add -A && git commit per the type(scope) format in contributing.md
            (e.g. feat(T016): add Pydantic schemas for exam domain).
            End the commit message with the Co-Authored-By trailer.
4. Push:    git push -u origin feature/<TaskID>-<slug>
5. Report the branch name + pushed commit SHA to the user.
```

Notes:
- One branch + one commit per task; branch off `main` unless the task depends on an
  unmerged prior task's branch.
- Confirm a remote named `origin` exists before pushing; if none, tell the user instead
  of failing silently.

### Per-Task Testing

Pick the verification that matches the task's surface — do not skip:

- **Backend tasks** (schemas, services, routes): contract tests with `pytest` under
  `backend/tests/contract/`, following the RED → GREEN cycle in the Backend Task Template.
  Pure-schema tasks (e.g. T016–T018) have no HTTP/UI surface yet — verify via import +
  field assertions; the contract test arrives with the route task.
- **Frontend / UI tasks**: use the **Playwright MCP server** to drive the running app in a
  real browser, verify the happy path + error states, then persist the flow as a spec under
  `tests/playwright/<feature>.spec.ts` so each UI task leaves a repeatable test case behind.
- A task that touches both layers gets both: contract test for the API + a Playwright spec
  for the UI flow.

### Branch & Deploy Strategy

```
main      → the ONLY deployable branch (Vercel production). Protected: merge via PR only.
staging   → long-lived local-integration branch. Feature branches merge here first for
            local end-to-end testing. NEVER auto-deployed (disabled in vercel.json →
            git.deploymentEnabled.staging = false).
feature/* → per-task branches (see Per-Task Git Workflow). PR into staging for testing,
            then staging → main once validated.
```

- `vercel.json` disables Vercel deployment for `staging`. Vercel treats `main` as the
  production branch by default. To block preview deployments on `feature/*` branches too,
  that must be toggled in the Vercel dashboard (Settings → Git) — it cannot be fully
  expressed in `vercel.json` (no wildcard for branch names).
- Run the app locally from `staging` for testing (`uv run uvicorn app.main:app --reload`
  + `cd frontend && npm run dev`); only promote to `main` what is meant to ship.

### Legacy Spec Files (original, kept for reference)
- `docs/DATABASE.md` — original DDL reference
- `docs/API.md` — original API spec
- `docs/RAG.md` — RAG pipeline design
- `docs/ARCHITECTURE.md` — architecture decision records
