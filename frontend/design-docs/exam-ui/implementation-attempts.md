# T040 — AttemptsPage Implementation Notes

## Files Created

| File | Purpose |
|---|---|
| `src/pages/student/AttemptsPage.tsx` | Main page component (default export) |
| `src/components/student/StatusBadge.tsx` | Local status-to-Badge mapper |

## Route

Add inside `<Routes>` in `App.tsx` (inside `<PrivateRoute>`):

```tsx
import AttemptsPage from '@/pages/student/AttemptsPage'

<Route
  path="/attempts"
  element={
    <PrivateRoute>
      <AttemptsPage />
    </PrivateRoute>
  }
/>
```

## Dependencies Used (all already installed)

| Package | Version in package.json | Usage |
|---|---|---|
| `date-fns` | ^3.6.0 | `format()` for date display |
| `lucide-react` | ^0.441.0 | `ClipboardList` icon in empty state |
| `react-router-dom` | ^6.26.2 | `Link` for action buttons |
| `@tanstack/react-query` | ^5.56.2 | via `useAttemptsList` hook |

No new shadcn primitives were installed — all used components were pre-installed.

## Component Architecture

```
AttemptsPage (default export)
└── TeacherPageShell  title="My Attempts"
    ├── [loading]  aria-busy div → Table with AttemptRowSkeleton × 5
    ├── [error]    Alert variant="destructive" → AlertDescription
    ├── [empty]    dashed-border div → ClipboardList icon + copy
    └── [data]     rounded border card → Table → AttemptRow × N
                       └── StatusBadge (local sub-component)
```

## Decisions Made

### 1. test_paper_title not available on AttemptSummary
The `AttemptSummary` type has `test_paper_id` but no `test_paper_title`.
Per the requirements (Option B), a secondary fetch was *not* added — that
would require a `useTestPapers()` join and complicate this page.
Instead, the "Test Paper" cell renders a shortened trailing-8-char ID
(e.g. `Test paper …a3f8b2c1`) as a human-scannable placeholder.

**Recommendation for follow-up**: extend `GET /api/attempts` to include
`test_paper_title` in the response, then update `AttemptSummary` type and
remove `testPaperLabel()` helper.

### 2. Date shown is submitted_at when available, started_at otherwise
For `submitted` and `timed_out` attempts the submitted/expiry time is the
more relevant anchor. For `in_progress` attempts only `started_at` is
available.

### 3. Status colour strategy
`submitted` → emerald green (success)
`in_progress` → amber (ongoing)
`timed_out` → muted grey (neutral/expired)
Colour is supplemental — the text label inside `StatusBadge` is always the
primary status conveyor (WCAG 1.4.1 compliant).

### 4. in_progress action → "Resume" link to /exam/:id
In-progress attempts link to `/exam/${attempt.id}` with label "Resume"
instead of "View Analysis", since there is no analysis yet.

### 5. Sort order
Client-side sort by `started_at` descending guards against un-sorted API
responses. If the API guarantees ordering this becomes a no-op copy.

### 6. TeacherPageShell reuse
Used as-is per task spec. Rename to a generic `PageShell` is flagged as a
clean-up task, not implemented here (out of scope for T040).

## Accessibility Notes

- Table uses semantic `<table>` via shadcn `Table` (assistive tech announces it).
- `<TableHead scope="col">` conveyed via the `th` element the shadcn primitive renders.
- Loading region has `aria-busy="true"` and `aria-label="Loading attempts"`.
- `AttemptRowSkeleton` rows have `aria-hidden="true"` so screen readers skip them.
- Action links carry `aria-label` with date context for screen reader disambiguation.
- Empty state uses `<p>` elements (not headings) per spec.
- Status is conveyed by text, not colour alone.

## Props / API Reference

### AttemptsPage
No props — data is fetched internally via `useAttemptsList()`.

### StatusBadge
| Prop | Type | Description |
|---|---|---|
| `status` | `string` | Attempt status value from API |

Handles unknown statuses gracefully with a neutral "Unknown" badge.

## Customisation

- To add a title column once the API includes it: replace `testPaperLabel(attempt.test_paper_id)` with `attempt.test_paper_title` and update the `AttemptSummary` type.
- To add filtering (by status/exam): introduce a local `useState` filter and `useMemo` on `attempts`.
- Status colours live in `STATUS_CONFIG` in `StatusBadge.tsx` — safe to extend.
