# Contributing Guide — QuizzerApp

**Last Updated**: 2026-06-14

---

## Development Workflow

### Before You Start

1. Read `docs/specifications/tasks.md` to find the next unchecked task
2. Read the relevant spec files for context (architecture, API endpoints, database design)
3. Confirm you understand the acceptance criteria (see `quickstart.md` for the relevant user journey)

### Task Execution Process

```
1. Open docs/specifications/tasks.md
2. Find the next [ ] task (start from the lowest task number)
3. Read the task description and linked spec sections
4. Follow the Backend or Frontend task template (see below)
5. Mark [ ] → [x] in tasks.md when done
6. Run tests to confirm no regressions
```

---

## Backend Task Template

For every backend task (API route, service, schema):

```
Step 1: Schema first
  → Create/update Pydantic schemas in backend/app/schemas/
  → Run: uv run python -c "from app.schemas.exam import ExamOut; print('ok')"
  → Confirm: no import errors

Step 2: Contract test (RED phase)
  → Write test in backend/tests/contract/test_{domain}_api.py
  → Run: uv run pytest tests/contract/test_{domain}_api.py -v
  → Confirm: tests FAIL (404 — route not implemented yet)

Step 3: Implementation (GREEN phase)
  → Write route handler in backend/app/api/routes/{domain}.py
  → Write service function in backend/app/services/{domain}_service.py if needed
  → Register router in main.py if it's a new file
  → Run: uv run pytest tests/contract/test_{domain}_api.py -v
  → Confirm: all tests PASS

Step 4: Manual verification
  → Open http://localhost:8000/docs
  → Find the new endpoint
  → Test happy path + error cases via Swagger UI

Step 5: Mark complete
  → Edit docs/specifications/tasks.md: [ ] → [x]
```

---

## Frontend Task Template

For every frontend task (page, component):

```
Step 1: Create the file
  → Component in frontend/src/components/{domain}/
  → Page in frontend/src/pages/{domain}/

Step 2: Wire the data
  → Add TanStack Query hook in frontend/src/hooks/ (if not already there)
  → Add API function in frontend/src/services/{domain}.ts
  → Add TypeScript types in frontend/src/types/{domain}.ts

Step 3: Manual verification
  → Run: cd frontend && npm run dev
  → Navigate to the route in browser
  → Test happy path
  → Test error state (bad network, 403, 404)
  → Check TypeScript: npm run type-check

Step 4: Mark complete
  → Edit docs/specifications/tasks.md: [ ] → [x]
```

---

## Code Review Checklist

Before marking a task complete, verify:

**Backend**
- [ ] All contract tests pass (`uv run pytest tests/contract/ -v`)
- [ ] No TypeErrors in Python (`uv run mypy app/` if configured)
- [ ] Route handler is thin — no business logic; calls service
- [ ] Pydantic schemas validate all inputs and sanitize all outputs
- [ ] `is_correct` field is NOT returned in student-facing question/option responses
- [ ] Role check (`require_role`) applied on all write endpoints

**Frontend**
- [ ] No `any` types in new TypeScript code (`npm run type-check` clean)
- [ ] TanStack Query used for API calls (no raw `fetch`/`useEffect` patterns)
- [ ] Loading and error states handled in UI
- [ ] No hardcoded API URLs — uses `import.meta.env.VITE_API_BASE_URL`
- [ ] `examSessionStore` accessed only from exam-related components

**Both**
- [ ] `docs/specifications/tasks.md` updated (task checked off)
- [ ] No console.log / print debug statements left in code

---

## Git Conventions

### Branch Naming

```
feature/T016-exam-schemas         # new feature (task number + slug)
fix/T033-timer-sync-on-resume     # bug fix
refactor/auth-service-cleanup     # refactor (no new behavior)
```

### Commit Messages

```
feat(T016): add Pydantic schemas for exam domain
fix(T033): sync elapsed time correctly on exam resume
test(T019): add contract tests for exam CRUD routes
refactor(auth): extract token rotation to separate function
```

Format: `type(scope): description`  
Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`

---

## Common Pitfalls

### 1. Returning `is_correct` to students

The `QuestionStudentOut` schema must NOT include `is_correct` on options. Use a separate schema from `QuestionOut` (which is for teacher/admin views).

### 2. Attempt uniqueness

`attempts` has `UNIQUE(user_id, test_paper_id)`. Attempting to start an already-attempted paper returns 409. The frontend must handle this and redirect to `/analysis/{attempt_id}`.

### 3. pgvector cosine similarity query

This is the only place raw SQL is acceptable:
```python
await db.execute(text(
    "SELECT id, content FROM document_chunks "
    "ORDER BY embedding <=> :embedding LIMIT :limit"
), {"embedding": str(query_vector), "limit": top_k})
```

### 4. BackgroundTasks for RAG processing

Document processing uses FastAPI `BackgroundTasks`. The route returns 202 immediately. Processing happens after response. Use `GET /api/rag/documents/{id}` to poll status.

### 5. examSessionStore persistence

`examSessionStore` must persist to `sessionStorage` (not `localStorage`). If the student closes the browser entirely and returns later, they should still be able to resume — but this uses the server state (`GET /api/attempts/{id}`), not the local store.
