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

## Reference Specifications
- **Database schema**: `docs/DATABASE.md`
- **API endpoints**: `docs/API.md`
- **RAG pipeline**: `docs/RAG.md`
- **Architecture decisions**: `docs/ARCHITECTURE.md`
