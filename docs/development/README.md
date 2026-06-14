# Development Guide — QuizzerApp

**Last Updated**: 2026-06-14

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Python | 3.12+ | [python.org](https://python.org) |
| `uv` | latest | `pip install uv` |
| PostgreSQL | 16+ | [neon.tech](https://neon.tech) (free tier) or Docker |
| Git | any | |

---

## Local Setup

### 1. Clone and Configure

```bash
git clone <repo-url> && cd QuizzerApp

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env — fill in DATABASE_URL, SECRET_KEY, OPENAI_API_KEY

# Frontend env
echo "VITE_API_BASE_URL=http://localhost:8000" > frontend/.env
```

### 2. Backend

```bash
cd backend
uv sync                              # install Python deps from pyproject.toml
uv run alembic upgrade head          # apply all migrations
uv run uvicorn app.main:app --reload # start at http://localhost:8000
# FastAPI docs: http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev    # start at http://localhost:5173
```

### 4. Local Database (Optional — Docker)

```bash
# From repo root
docker compose up -d
# PostgreSQL at localhost:5432, pgAdmin at http://localhost:5050
```

---

## Project Commands

### Backend

```bash
cd backend

# Development
uv run uvicorn app.main:app --reload           # dev server
uv run uvicorn app.main:app --port 8000        # specific port

# Database
uv run alembic upgrade head                    # apply migrations
uv run alembic revision --autogenerate -m "description"  # new migration
uv run alembic downgrade -1                    # rollback one step

# Testing
uv run pytest                                  # all tests
uv run pytest tests/contract/ -v               # contract tests only
uv run pytest tests/contract/test_exam_api.py  # single test file
uv run pytest --cov=app --cov-report=term-missing  # with coverage

# Code quality
uv run ruff check .                            # lint
uv run ruff format .                           # format
```

### Frontend

```bash
cd frontend

npm run dev          # Vite dev server (HMR)
npm run build        # production build → dist/
npm run preview      # preview production build locally
npm run lint         # ESLint
npm run type-check   # TypeScript check (no emit)
```

### Playwright E2E (from root)

```bash
# Install browsers (first time only)
npx playwright install

# Run all E2E tests
npx playwright test

# Run specific suite
npx playwright test tests/playwright/auth.spec.ts

# Debug mode (headed browser)
npx playwright test --headed --debug
```

---

## Coding Conventions

### Python (Backend)

- **Pydantic v2** for all schemas: use `model_config = ConfigDict(from_attributes=True)`
- **Async everywhere**: `async def`, `async with session.begin()`, `await` for all DB ops
- **Thin routes**: handlers validate auth and call services; no business logic in route handlers
- **No raw SQL**: SQLAlchemy ORM or `select()` statements only (pgvector cosine query is the exception)
- **All routes prefix `/api`**: `app.include_router(router, prefix="/api")`
- **Explicit return types**: all service functions have type annotations

```python
# ✅ Correct
async def get_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = 1,
    limit: int = 20,
) -> list[ExamOut]:
    result = await db.execute(select(Exam).offset((page-1)*limit).limit(limit))
    return result.scalars().all()

# ❌ Wrong — raw SQL, sync, logic in route
def get_exams(db):
    return db.execute("SELECT * FROM exams")
```

### TypeScript (Frontend)

- **No `any`** — use explicit types from `frontend/src/types/` or `unknown`
- **TanStack Query for all server state** — no `useEffect` + `fetch` patterns
- **Zustand only for local UI state** (exam session, not API data)
- **Pages own data fetching** — components are presentational; pages call hooks
- **Zod for form validation** — paired with react-hook-form

```tsx
// ✅ Correct — page owns data fetching
export function ExamsPage() {
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
  })
  return <ExamList exams={exams ?? []} loading={isLoading} />
}

// ✅ Correct — component is presentational
function ExamList({ exams, loading }: { exams: ExamOut[]; loading: boolean }) { ... }
```

### File Naming

| Type | Convention | Example |
|---|---|---|
| Python modules | snake_case | `auth_service.py` |
| Python classes | PascalCase | `class ExamOut` |
| React components | PascalCase.tsx | `QuestionPalette.tsx` |
| React pages | PascalCase.tsx | `ExamPage.tsx` |
| Hooks | camelCase, `use` prefix | `useExamSession.ts` |
| Store files | camelCase, `Store` suffix | `examSessionStore.ts` |

---

## Architecture Patterns

### Backend Request Lifecycle

```
Route handler (thin)
  → require_role dep (auth check)
  → Service function (business logic)
  → SQLAlchemy query
  → Pydantic schema serialization
  → JSON response
```

### Frontend Data Flow

```
Page component
  → TanStack Query useQuery/useMutation
  → services/ API function (Axios)
  → Backend endpoint
  → Response cached by TanStack Query
  → Component re-renders with data
```

### Exam Session (Special Case)

The exam interface bypasses TanStack Query for real-time state to avoid re-render latency:

```
Answer click
  → examSessionStore.setAnswer() (synchronous Zustand update → instant UI)
  → Axios PUT /api/attempts/{id}/answer (async, fire-and-forget)
  → Server saves within ~10s
```

---

## Testing Philosophy

**Backend**: Contract-first TDD
1. Write Pydantic schema
2. Write contract test (asserts response shape + status codes)
3. Run test → RED (not implemented)
4. Implement route/service
5. Run test → GREEN

**Frontend**: Manual verification via dev server  
- Run `npm run dev`, navigate to the feature, test happy path + error states  
- Playwright E2E tests cover critical flows (auth, exam, analysis)

**No mocking the database**: Tests use a real PostgreSQL test DB (separate from dev DB). Set `TEST_DATABASE_URL` in backend `.env`.

---

## Environment Variables Reference

### Backend (`backend/.env`)

```env
# Required
DATABASE_URL=postgresql+asyncpg://user:pass@host/quizzerapp
SECRET_KEY=minimum-32-character-random-string

# Required for RAG
OPENAI_API_KEY=sk-...
VERCEL_BLOB_READ_WRITE_TOKEN=...

# Optional — falls back to OpenAI for question generation
ANTHROPIC_API_KEY=sk-ant-...

# Optional — AWS S3 as alternative to Vercel Blob
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# App config
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Testing (separate DB to avoid data collision)
TEST_DATABASE_URL=postgresql+asyncpg://user:pass@host/quizzerapp_test
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
# In production, leave empty (same domain, no prefix needed)
```

---

## Custom Claude Code Commands

Located in `.claude/commands/`:

| Command | File | Description |
|---|---|---|
| `/add-question` | `add-question.md` | Add a question to the question bank |
| `/generate-test` | `generate-test.md` | Generate a test paper from the question bank |
| `/run-migrations` | `run-migrations.md` | Run pending Alembic migrations |
| `/seed-data` | `seed-data.md` | Seed test data (exams, questions, test papers) |

Usage: type `/add-question` in Claude Code to invoke.
