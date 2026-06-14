# T027 — Exam Management Page: Implementation Notes

## Files Created

| File | Purpose |
|---|---|
| `frontend/src/pages/teacher/ExamsPage.tsx` | Main page (default export, route `/teacher/exams`) |
| `frontend/src/components/teacher/CreateExamDialog.tsx` | Controlled dialog with RHF + Zod form |
| `frontend/src/components/teacher/ExamCard.tsx` | Per-exam card with inline subject management |

## Architecture Decisions

### Component split
Three files rather than one monolith:
- `ExamsPage` owns page-level state (`dialogOpen`) and data fetching (`useExams`).
- `CreateExamDialog` is a self-contained controlled dialog that calls `useCreateExam` internally, fires its own toasts, and resets the form via `useEffect` on `open`.
- `ExamCard` owns per-card state (`subjectInput`) and calls `useExamSubjects` + `useCreateSubject` for its own data slice. This keeps subject-list re-renders isolated to the card that changes.

### Dialog placement
`<CreateExamDialog>` is rendered as a sibling of `<TeacherPageShell>` (outside it), not inside the shell's children. This ensures the Radix portal renders in the correct stacking context and avoids z-index conflicts with the sticky header.

### Subjects lazy-loading
Each `ExamCard` independently calls `useExamSubjects(exam.id)`. TanStack Query deduplicates concurrent requests and caches per exam ID. On subject creation, the hook invalidates only `examKeys.subjects(examId)`, so only the affected card re-fetches.

### Add-subject UX
Pressing Enter in the subject input fires the same handler as clicking the Plus button. The input refocuses after a successful add so rapid entry is frictionless. A minimum length of 2 characters is validated client-side before calling the mutation to avoid a round-trip for obvious errors.

## Accessibility

- `DialogTitle` is always present — Radix wires `aria-labelledby` automatically.
- `DialogDescription` provides supplementary context for screen readers.
- Loading skeleton grid carries `aria-busy="true"` and `aria-label="Loading exams"`.
- Subject chip list uses `role="list"` / `role="listitem"` semantics.
- Add-subject `Button` and `Input` each carry `aria-label="Add subject to {exam.title}"`.
- `Tooltip` duplicates the button's `aria-label` so keyboard users get the label without hover.
- Published/Draft badge always renders the text label alongside color (color is not the sole indicator).

## Assumptions

1. `useExams()` with no arguments returns the first page of all exams for the authenticated teacher. Pagination controls are not included in T027; they can be layered on later.
2. `Paginated<Exam>.items` may be an empty array on first load; the empty state handles this gracefully.
3. The `Toaster` and `TooltipProvider` are mounted at app root (in `App.tsx`). The components here call `toast.*` and `<Tooltip>` without re-wrapping providers.
4. `exam.subjects` on the `Exam` type is nullable/optional — the page does not rely on it; it always fetches subjects via `useExamSubjects` for freshness.

## What still needs wiring (outside T027 scope)

- Route `/teacher/exams` must be added to `App.tsx` (guarded by `PrivateRoute`, role-checked for `teacher`).
- `<Toaster>` and `<TooltipProvider>` should be added to `App.tsx` root before these pages render.
