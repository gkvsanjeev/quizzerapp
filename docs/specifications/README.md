# QuizzerApp — Technical Specifications

Comprehensive technical and business specifications for the QuizzerApp exam platform.

**Last Updated**: 2026-06-14  
**Current Phase**: Phase 2 — Exam Management API

---

## Specification Documents

### Business & Product
- **[Business Requirements](business-requirements.md)** — What the system does: user stories, acceptance criteria, functional requirements
- **[Quickstart / User Journeys](quickstart.md)** — 9 core flows for end-to-end validation

### Technical Design
- **[Technical Architecture](technical-architecture.md)** — System design, technology decisions, constitution checks
- **[Research](research.md)** — Technology evaluation and decision rationale (ADRs)
- **[Database Design](database-design.md)** — 14-table PostgreSQL schema with relationships
- **[API Endpoints](api-endpoints.md)** — Complete REST API reference with request/response examples
- **[RAG Pipeline](rag-pipeline.md)** — AI-powered question generation from uploaded documents

### Implementation
- **[Tasks](tasks.md)** — Sequential implementation roadmap (67 tasks across 6 phases)
- **[API Contracts](contracts/)** — OpenAPI 3.0 spec + contract testing guide

---

## Project Status

**Progress**: 15 / 67 tasks completed (22%)  
**Last Updated**: 2026-06-14

### ✅ Completed (Phase 0 + Phase 1 — 15 tasks)

**Setup & Configuration** (T001–T005):
- T001: Monorepo scaffold (Vite + FastAPI, vercel.json, docker-compose)
- T002: Core dependencies (React 18, FastAPI, SQLAlchemy, pgvector, LangChain)
- T003: Dev tools (TypeScript, ESLint, Tailwind, shadcn/ui init)
- T004: PostgreSQL schema design (14 tables documented)
- T005: Alembic initial migration (001_initial_schema)

**Auth + DB Layer** (T006–T015):
- T006: SQLAlchemy async models (user, exam, question, test_paper, attempt, rag)
- T007: Pydantic v2 auth schemas (RegisterIn, LoginIn, TokenOut, UserOut)
- T008: Auth service (JWT encode/decode, bcrypt, refresh token rotation)
- T009: Auth API routes (register, login, refresh, logout, me)
- T010: CORS middleware + Mangum ASGI adapter
- T011: Frontend auth pages (Login + Register with Zod validation)
- T012: Axios API client with 401 interceptor + token auto-refresh
- T013: Zustand authStore (user, isAuthenticated, accessToken)
- T014: Frontend dashboard (basic — role, email display, logout)
- T015: Docker compose (PostgreSQL 16 + pgAdmin for local dev)

### 🔄 Active Phase — Phase 2: Exam Management API + UI (T016–T026)

**Next task**: T016 — Pydantic schemas for exam domain

### ⏳ Pending Phases

| Phase | Tasks | Focus |
|---|---|---|
| Phase 3: Exam Taking | T027–T037 | Attempt flow, auto-save, timer, exam UI |
| Phase 4: Analysis | T038–T051 | 9 analytics datasets + Recharts visualizations |
| Phase 5: RAG/AI | T052–T059 | Document processing, embedding, question generation |
| Phase 6: Polish | T060–T067 | Leaderboard, admin, E2E tests, deployment |

---

## Implementation Stats

- **API Routes implemented**: 5 (auth only — register, login, refresh, logout, me)
- **API Routes planned**: 40+ (exam, question, attempt, analysis, RAG)
- **Frontend pages**: 3 (Login, Register, Dashboard)
- **Frontend pages planned**: 15+ (exam interface, 9 analysis sections, teacher UI, admin)
- **Database tables**: 14 (all designed and migrated)
- **Test coverage**: 0 (TDD begins Phase 2)

---

## Development Workflow

### Sequential Execution Rule

Tasks in `tasks.md` must be executed in dependency order:

```
Pydantic schemas → Contract tests → API routes → Frontend pages
```

Every domain follows this same TDD cycle:
1. Write Pydantic schemas (request + response types)
2. Write contract tests (what the API must return)
3. Implement API routes (make contract tests pass)
4. Build frontend page (consume the API)

### Task Commands

```bash
# Check what to work on next
grep -n "^- \[ \]" docs/specifications/tasks.md | head -5

# Mark a task complete (change [ ] to [x])
# Edit tasks.md manually or via Claude Code

# Check overall progress
grep -c "\[x\]" docs/specifications/tasks.md
grep -c "\[ \]" docs/specifications/tasks.md
```

---

## Quality Standards

### Testing Requirements
- **Schema-first TDD**: Pydantic schemas and contract tests before implementation
- **Real database**: pytest with async test DB (no mocks for DB operations)
- **E2E coverage**: Playwright for critical user flows (auth, exam, analysis)

### Performance Targets
- **API response**: < 200ms (p95) for CRUD; < 500ms for analysis computation
- **Exam UI**: No lag on answer selection (optimistic updates via Zustand)
- **Analysis load**: < 2s for all 9 sections on submit

### Security Standards
- JWT access tokens: 15-minute expiry, memory storage only
- Refresh tokens: httpOnly cookie, hashed in DB, rotated on use
- Role-based access: `require_role("teacher")` / `require_role("admin")` deps
- Input validation: Pydantic v2 on all endpoints
