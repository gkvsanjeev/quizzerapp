# Technical Research — QuizzerApp

**Last Updated**: 2026-06-14  
**Phase**: 0 — Research & Technology Validation (Complete)

---

## Frontend Framework Decision

**Decision**: React 18 + Vite (SPA)  
**Rationale**:
- Vite gives sub-second HMR and fast production builds — critical for a component-heavy exam UI
- React 18 concurrent features (Suspense, transitions) enable smooth question navigation without jank
- SPA model fits the exam interface perfectly: no full-page reloads during exam, timer stays running
- shadcn/ui ecosystem matches React 18 patterns natively

**Alternatives considered**:
- Next.js: SSR adds complexity we don't need — the exam UI has no SEO requirement, and serverless SSR + async Python backend creates routing conflicts on Vercel
- Vue 3: Smaller community for exam/testing-specific component patterns; team prefers React

---

## UI Component Library Decision

**Decision**: shadcn/ui + Tailwind CSS  
**Rationale**:
- Copy-paste model gives full ownership — no library version drift breaking the exam timer mid-session
- Built on Radix UI primitives for accessibility (keyboard navigation in question palette)
- Tailwind utilities enable rapid custom styling for exam-specific UI (question status colors, palette grid)
- MCP integration available for component discovery

**Alternatives considered**:
- Material UI: Too opinionated for a CBT (computer-based test) aesthetic; hard to override exam-interface styles
- Ant Design: Desktop-first; mobile exam use case isn't a priority fit

---

## State Management Decision

**Decision**: TanStack Query (server state) + Zustand (exam session state)  
**Rationale**:
- TanStack Query handles caching, background refetching, optimistic updates for API calls — eliminates manual loading/error state in 15+ pages
- Zustand is minimal and synchronous — ideal for the real-time exam session (current question index, local answer buffer, elapsed time, palette status)
- Zustand `examSessionStore` persists to `sessionStorage` so a browser refresh doesn't lose the exam state
- Separation keeps concerns clean: TQ owns "what the server knows", Zustand owns "what the user is currently doing"

**Key stores**:
- `authStore`: `{ user, accessToken, setToken, clearToken }`
- `examSessionStore`: `{ attemptId, currentQuestionIndex, localAnswers, timeElapsed, isPaused }`

**Alternatives considered**:
- Redux Toolkit: Overkill; exam state is transient and doesn't need time-travel debugging
- React Context: Not suitable — exam state updates on every timer tick would cause full tree re-renders

---

## Charts Library Decision

**Decision**: Recharts  
**Rationale**:
- React-native composable API — each chart is a React component, no imperative DOM manipulation
- Built on d3 but exposes a JSX API — TypeScript-friendly
- Covers all 9 analysis chart types: bar, donut, pie, line, area, scatter, and custom timeline (built with Recharts primitives + CSS)
- Smaller bundle than ECharts (~100KB vs ~900KB gzipped)

**Chart → Analysis section mapping**:
| Analysis Section | Chart Type |
|---|---|
| Overview | KPI cards + RadialBarChart |
| Performance | Grouped BarChart by subject |
| Time | Histogram (BarChart) + PieChart |
| Attempts | DonutChart (PieChart) + waterfall BarChart |
| Difficulty | Stacked BarChart |
| Subject Movement | Custom CSS timeline |
| Question Journey | Vertical timeline (custom) |
| Question by Question | Data table (no chart) |

---

## Backend Framework Decision

**Decision**: Python FastAPI + Mangum  
**Rationale**:
- FastAPI provides automatic OpenAPI docs, Pydantic v2 validation, async-first design with `asyncio`
- Mangum translates Vercel's Lambda invocations to ASGI events — no framework rewrite for serverless
- Python is the natural language for the RAG pipeline (LangChain, pdfplumber, pytesseract, OpenAI SDK all Python-native)
- Keeping frontend (JS) and backend (Python) in the same monorepo avoids the "two repos" coordination tax

**Alternatives considered**:
- Node.js/Express: Would eliminate Python for RAG, requiring native JS bindings for OCR/embedding — fragile
- Django: Sync-first, heavier ORM, less ergonomic for async Neon connection pool

---

## Database Decision

**Decision**: Neon Serverless PostgreSQL 16 + pgvector  
**Rationale**:
- Native Vercel integration (env vars auto-provisioned, connection pooling built-in)
- pgvector extension required for RAG embeddings — one DB for both relational data and vectors (no sync issues)
- Standard PostgreSQL SQL — no vendor-specific query syntax; easy to migrate to Railway/Supabase if needed
- Free tier covers development and early production; upgrading is a slider, not a migration

**Trade-off**: Neon free tier has a 0.5 CPU compute limit. For 1000+ concurrent exam users, upgrade to paid tier.

**Alternatives considered**:
- Pinecone (vector only): Adds a second service to manage; overkill for <100k chunks
- Supabase: Similar to Neon but pgvector support came later; Neon has better Vercel integration today

---

## ORM Decision

**Decision**: SQLAlchemy 2.x async + Alembic  
**Rationale**:
- SQLAlchemy 2.x has a clean async API (`async with session.begin()`) that pairs naturally with FastAPI
- Alembic provides schema migration with `--autogenerate` from model definitions
- No raw SQL needed — Alembic + ORM keeps schema/model in sync automatically

---

## Auth Strategy Decision

**Decision**: JWT access tokens (15 min) in memory + refresh tokens (7 days) in httpOnly cookie  
**Rationale**:
- httpOnly cookies protect refresh tokens from XSS attacks (cannot be read by JavaScript)
- Short JWT expiry limits blast radius of a stolen token to 15 minutes
- Refresh tokens stored as bcrypt hashes in DB — revocable on logout
- No Redis needed: access tokens are stateless (verified by signature); refresh token DB lookup is one query

**Trade-off**: Access tokens cannot be instantly revoked before expiry. Acceptable: 15-min max exposure window.

---

## Deployment Decision

**Decision**: Vercel monorepo (static frontend + Python serverless backend)  
**Rationale**:
- Vercel natively supports monorepos: one `vercel.json`, one deploy, shared env vars
- Frontend builds to static files (`dist/`) served from CDN
- Backend runs as a single Vercel Function (`backend/app/main.py` via Mangum)
- Same domain in production → no cross-origin CORS issues

**Trade-off**: Vercel serverless cold starts (200–500ms) for Python. Mitigated by Mangum's lightweight handler and Neon's connection pooling.

---

## RAG / LLM Technology Decisions

**Decision**: LangChain + OpenAI text-embedding-3-small + Claude claude-sonnet-4-6 (question generation)  
**Rationale**:
- LangChain provides `RecursiveCharacterTextSplitter` and document loaders — battle-tested chunking strategies
- `text-embedding-3-small` gives 1536-dim embeddings at ~$0.10/1M tokens — cost-effective for a doc corpus
- Claude claude-sonnet-4-6 excels at structured JSON output and instruction-following — better accuracy on MCQ generation
- Both OpenAI and Anthropic SDKs are supported; switching is a single service method change

**Chunking parameters**: `chunk_size=500, chunk_overlap=50`  
**Retrieval**: cosine similarity via pgvector, `top_k=15` chunks as context

---

## OCR Decision

**Decision**: pdfplumber (text PDFs) + pytesseract (scanned PDFs / images)  
**Rationale**:
- pdfplumber extracts structured text from text-based PDFs without OCR overhead
- pytesseract as fallback when pdfplumber returns empty (scanned/image PDFs)
- Both are Python-native, no external service dependency

**Supported formats**: PDF (text), PDF (scanned), PNG, JPEG, WEBP, TIFF
