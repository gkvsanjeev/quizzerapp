# Architecture Decisions — QuizzerApp

## ADR-001: Monorepo with Vercel Deployment

**Decision**: Single repository with `frontend/` and `backend/` directories, deployed as one Vercel project.

**Why**: Vercel natively supports monorepos — frontend builds to static files, Python backend runs as serverless functions via Mangum. Single deploy, shared env vars, no cross-origin CORS complexity in production (same domain). Simplifies CI/CD for a solo/small team.

**Trade-off**: Serverless cold starts (~200-500ms) for the Python backend. Acceptable for exam prep use case (not real-time trading). Mitigated by keeping handlers lightweight and connection-pooling via Neon's serverless driver.

---

## ADR-002: Neon Serverless PostgreSQL

**Decision**: Use Neon (neon.tech) as the database provider.

**Why**:
- Native Vercel integration (env vars auto-provisioned)
- Supports pgvector extension (required for RAG embeddings)
- Free tier covers development and early-stage production
- Serverless connection pooling (no idle connections wasted in serverless env)
- Standard PostgreSQL — no vendor-specific query syntax

**Trade-off**: Neon free tier has a 0.5 CPU compute limit. For large exam loads (1000+ concurrent users), upgrade to paid tier or switch to Supabase/Railway.

---

## ADR-003: FastAPI + Mangum for Serverless Python

**Decision**: FastAPI application wrapped with Mangum ASGI adapter for Vercel.

**Why**: FastAPI gives automatic OpenAPI docs, Pydantic v2 validation, async-first design, and Python type hints throughout. Mangum translates Vercel's Lambda-style invocations to ASGI events — no framework rewrite needed.

**vercel.json configuration**:
```json
{
  "functions": { "backend/app/main.py": { "runtime": "python3.12", "maxDuration": 60 } }
}
```

---

## ADR-004: JWT Access Token + Refresh Token Strategy

**Decision**: Short-lived JWT access tokens (15 min) stored in memory, long-lived refresh tokens (7 days) in httpOnly cookies.

**Why**:
- httpOnly cookies protect refresh tokens from XSS attacks
- Short JWT expiry limits blast radius of token theft
- Refresh tokens stored hashed in DB allows revocation on logout
- No Redis needed — stateless access tokens validated by signature

**Trade-off**: Cannot instantly revoke access tokens before they expire. Acceptable: 15-min max window for compromised tokens.

---

## ADR-005: TanStack Query + Zustand State Split

**Decision**: TanStack Query for all server/async state; Zustand only for exam session UI state.

**Why**:
- TanStack Query handles caching, refetching, background updates, optimistic updates — eliminates manual loading/error state
- Zustand is minimal and synchronous — ideal for tracking the current exam session (current question index, time elapsed, local answer state before autosave)
- Zustand `examSessionStore` persists to `sessionStorage` so the exam can survive a page refresh without a round-trip

**Key stores**:
- `authStore`: `{ user, accessToken, setToken, clearToken }`
- `examSessionStore`: `{ attemptId, currentQuestionIndex, localAnswers, timeElapsed, isPaused }`

---

## ADR-006: Recharts for Analytics

**Decision**: Recharts as the charting library.

**Why**: React-native composable API, built on d3, no imperative DOM manipulation, supports all needed chart types: bar, donut/pie, line, area, scatter, timeline/gantt-style. Smaller bundle than ECharts.

**Chart mapping**:
| Analysis Section | Chart Type |
|---|---|
| Overview | KPI cards + radial gauge |
| Performance | Grouped bar chart |
| Time | Histogram + pie |
| Attempts | Donut + waterfall bar |
| Difficulty | Stacked bar |
| Subject Movement | Custom timeline (CSS-based) |
| Question Journey | Vertical timeline (custom) |
| Question by Question | Data table + row color coding |

---

## ADR-007: pgvector for RAG Embeddings

**Decision**: Store embeddings directly in PostgreSQL using pgvector rather than a dedicated vector DB (Pinecone, Weaviate).

**Why**:
- Eliminates an additional service/cost
- Neon supports pgvector natively
- For expected document corpus size (<100k chunks), pgvector with IVFFlat index is fast enough
- Keeps data in one place (no sync issues between Postgres and vector DB)

**Trade-off**: At >1M chunks, consider migrating to a dedicated vector DB. Add IVFFlat index at >10k chunks:
```sql
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## ADR-008: Real Exam Interface — Full Screen + Auto-Save

**Decision**: Full-screen browser mode (`document.documentElement.requestFullscreen()`) with auto-save every 10 seconds and on every answer change.

**Why**:
- Mimics UPSC/JEE computer-based test (CBT) experience
- Auto-save ensures no progress loss on network issues
- Storing `visit_count`, `change_count`, `first_visited_at`, `last_visited_at` per question enables the Question Journey and Time Analysis features

**Exam state machine**:
```
not_started → in_progress → submitted (manual) | timed_out (frontend timer fires)
```
On timer expiry: frontend calls `POST /api/attempts/{id}/submit` automatically.

---

## ADR-009: Analysis Computed on Submit

**Decision**: `attempt_subject_stats` computed synchronously on submit; complex analyses (question journey, subject movement) computed on-the-fly from `attempt_answers`.

**Why**:
- Subject stats are small aggregates — fast to compute on submit
- Question-level analyses involve sorting/filtering the `attempt_answers` rows — acceptable latency (<100ms for 90 questions)
- Avoids a background job for analytics computation
- `leaderboard_cache` table holds pre-computed leaderboard for expensive rank/percentile queries
