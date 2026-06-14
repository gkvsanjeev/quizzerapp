# QuizzerApp Documentation

Full-stack exam platform for competitive exam preparation (JEE, NEET, UPSC, GATE).  
Students take timed mock tests and receive 9-section deep analytics. Teachers use AI-assisted RAG to generate questions from PDFs.

**Last Updated**: 2026-06-14

---

## Documentation Structure

```
docs/
├── README.md                              # This file — navigation hub
├── specifications/
│   ├── README.md                          # Project status + spec overview
│   ├── business-requirements.md           # WHAT the system does (no tech)
│   ├── research.md                        # Technology decisions + rationale
│   ├── technical-architecture.md          # System design + ADRs
│   ├── database-design.md                 # Full PostgreSQL schema (14 tables)
│   ├── api-endpoints.md                   # Complete REST API reference
│   ├── rag-pipeline.md                    # RAG document → question generation
│   ├── quickstart.md                      # 9 core user journeys for validation
│   ├── tasks.md                           # Implementation roadmap (67 tasks)
│   └── contracts/
│       ├── README.md                      # Contract testing guide
│       └── api-spec.yaml                  # OpenAPI 3.0 specification
├── development/
│   └── README.md                          # Dev setup, conventions, commands
└── guides/
    ├── contributing.md                    # Task workflow + contribution rules
    └── documentation-standards.md        # Doc organization rules
```

---

## Quick Navigation

### New Developers
1. **[Development Guide](development/README.md)** — setup, commands, conventions
2. **[Current Tasks](specifications/tasks.md)** — what to implement next
3. **[Database Schema](specifications/database-design.md)** — data models
4. **[API Reference](specifications/api-endpoints.md)** — endpoints + examples

### For Planning / Product
1. **[Business Requirements](specifications/business-requirements.md)** — feature spec (WHAT)
2. **[User Journeys](specifications/quickstart.md)** — 9 validation scenarios
3. **[Technical Architecture](specifications/technical-architecture.md)** — system design

### For AI / RAG Features
1. **[RAG Pipeline](specifications/rag-pipeline.md)** — document → question flow
2. **[Question Generation API](specifications/api-endpoints.md#rag-routes)** — endpoints
3. **[Research](specifications/research.md)** — LLM/embedding technology decisions

### For API / Contract Testing
1. **[OpenAPI Spec](specifications/contracts/api-spec.yaml)** — machine-readable spec
2. **[Contract Testing Guide](specifications/contracts/README.md)** — how to write contract tests
3. **[API Endpoints](specifications/api-endpoints.md)** — request/response examples

---

## Project Status

**Phase**: Phase 2 — Exam Management API  
**Progress**: 15 / 67 tasks completed (22%)

| Phase | Tasks | Status |
|---|---|---|
| Phase 0: Scaffold + Config | T001–T005 | ✅ Complete |
| Phase 1: Auth + DB Models | T006–T015 | ✅ Complete |
| Phase 2: Exam Management API + UI | T016–T026 | 🔄 In Progress |
| Phase 3: Exam Taking | T027–T037 | ⏳ Pending |
| Phase 4: Analysis | T038–T051 | ⏳ Pending |
| Phase 5: RAG/AI | T052–T059 | ⏳ Pending |
| Phase 6: Leaderboard + Admin + Polish | T060–T067 | ⏳ Pending |

**Next task**: T016 — Pydantic schemas for exam domain (ExamCreate, ExamOut, SubjectCreate, etc.)

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| State | TanStack Query (server state) + Zustand (exam session) |
| Charts | Recharts (9 analysis visualizations) |
| Backend | Python FastAPI + Mangum (Vercel serverless) |
| ORM | SQLAlchemy 2.x async + Alembic migrations |
| Database | Neon Serverless PostgreSQL 16 + pgvector |
| Auth | JWT (15min) + httpOnly refresh tokens (7 days) |
| AI/RAG | LangChain + OpenAI embeddings + Claude/GPT-4o generation |
| OCR | pdfplumber + pytesseract |
| Deployment | Vercel monorepo + Neon DB |
