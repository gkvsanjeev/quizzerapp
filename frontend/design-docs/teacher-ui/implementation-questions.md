# T028 — Question Bank Page: Implementation Notes

**Task:** T028  
**Route:** `/teacher/questions`  
**Files written:**
- `frontend/src/pages/teacher/QuestionBankPage.tsx` (default export)
- `frontend/src/components/teacher/QuestionFormDialog.tsx`
- `frontend/src/components/teacher/DeleteQuestionDialog.tsx`

---

## Setup

All shadcn/ui components referenced were already installed before this task ran.
No `npm install` or `npx shadcn add` commands are needed.

### App-root providers (action required before this page renders correctly)

`App.tsx` currently wraps nothing with `<TooltipProvider>` or `<Toaster>`.
`QuestionBankPage` mounts its own `<TooltipProvider>` locally, which is valid per
Radix docs (nested providers are idempotent). However, `toast()` from `sonner`
requires `<Toaster>` to be mounted somewhere in the tree — without it, toasts are
silently swallowed.

**Add once to `App.tsx` (or the root layout shared with ExamsPage/TestPaperPage):**

```tsx
import { Toaster } from '@/components/ui/sonner'
// inside return:
<Toaster position="top-right" richColors closeButton />
```

---

## Component breakdown

### QuestionBankPage (page, default export)

State owned:
| State | Type | Purpose |
|---|---|---|
| `searchInput` | `string` | Controlled value for the search box |
| `filterExamId` | `string` | Drives the Subject filter's exam context |
| `filterSubjectId` | `string` | Applied to `useQuestions` after debounce |
| `filterDifficulty` | `string` | Applied to `useQuestions` after debounce |
| `debouncedFilters` | `QuestionFilters` | 300 ms debounced; fed to `useQuestions()` |
| `dialogMode` | `'create' \| 'edit' \| null` | Which form dialog is open |
| `editTarget` | `Question \| null` | Question being edited |
| `deleteTarget` | `Question \| null` | Question awaiting delete confirmation |

Data hooks used:
- `useQuestions(debouncedFilters)` — drives the table
- `useExams()` — inside `FilterPanel` for the Exam filter drop-down
- `useExamSubjects(examId)` — inside `FilterPanel` for Subject filter
- `useDeleteQuestion()` — wired to `DeleteQuestionDialog.onConfirm`

### QuestionFormDialog

Renders either `CreateQuestionForm` or `EditQuestionForm` based on `mode` prop.

**Create form** (`mode="create"`):
- Two-level exam → subject selector (uncontrolled by RHF; manually wired via
  `form.setValue` because the Select values are cascaded)
- 4 option text inputs (`option_a` … `option_d`) with a custom radio-button row that
  calls `correctField.onChange(key)` — avoids a nested `FormField` on each row while
  still keeping `correct_key` fully validated by Zod
- On submit: assembles `OptionInput[]` (sets `is_correct`) and calls
  `createQuestion.mutateAsync`

**Edit form** (`mode="edit"`):
- Pre-fills text / difficulty / explanation / tags from `question` prop
- `useEffect` keyed on `question.id` resets the form whenever a different question
  is targeted (dialog closed-and-reopened for a new row)
- No options field — `QuestionUpdatePayload` does not support updating options
- Amber info callout tells the teacher why options are locked

### DeleteQuestionDialog

Thin wrapper around `AlertDialog`. Receives `onConfirm` and `isDeleting` from the
page; the page owns the mutation so delete state and toast remain co-located.

---

## Key design decisions / assumptions

1. **Subject name in the table.** `Question` (from `@/types/question.ts`) does not
   carry a `subject_name` field — only `subject_id`. The row displays `subject_id`
   as a fallback. If the API is extended to include `subject_name` on `QuestionOut`,
   the cast `(q as Question & { subject_name?: string }).subject_name` will resolve
   it transparently without any code change.

2. **Search filter.** `QuestionFilters` (from `@/types/question.ts`) has no `search`
   field, so the search input is wired as a 300 ms debounced `searchInput` state
   variable that feeds into the filter object only when the backend supports it. If
   a `search?: string` field is added to `QuestionFilters` later, uncomment the
   `if (searchInput) next.search = searchInput` line in the debounce effect.

3. **Correct-answer radio UX.** Rather than using shadcn `RadioGroup` + `RadioGroupItem`
   inline (which caused conflicting focus rings inside the option rows), a custom
   `role="radio"` button is used per row. It calls `correctField.onChange(key)`
   directly and is keyboard-accessible via `focus-visible:ring`. This gives cleaner
   visual alignment (circle, key label, text input on one row) while keeping
   `correct_key` fully validated by the Zod schema.

4. **TooltipProvider scope.** The page mounts its own `<TooltipProvider
   delayDuration={300}>` wrapping the entire return tree. This is valid for Vite SPAs
   where `App.tsx` does not yet provide one. Once T027/T029 also land and `App.tsx`
   is updated to mount a single root `TooltipProvider`, the local one can be removed.

5. **Pagination.** `useQuestions` supports `page` / `limit` filters but the page does
   not yet render pagination controls — the initial design uses default pagination from
   the API. Pagination UI can be layered on top by exposing a `page` state and passing
   it into `debouncedFilters`.

---

## Accessibility checklist

- Table uses semantic `<table>` via shadcn Table; `<th scope="col">` is added
  automatically by the `TableHead` component.
- `aria-live="polite"` sr-only paragraph announces result count changes.
- `aria-busy={isLoading}` on the table border `<div>` signals loading to assistive tech.
- Each `DropdownMenuTrigger` carries a full descriptive `aria-label` including the
  question preview text.
- `RadioGroup` for correct-answer (create form) is aria-labeled "Correct answer".
- `AlertDialog` (delete) cannot be dismissed by clicking the backdrop — Radix enforces
  this, so the user must explicitly click Cancel or Delete.
- All icon-only buttons have either `aria-label` or an inner `<span className="sr-only">`.
- Filter selects all carry explicit `aria-label` attributes in addition to `<Label>`.

---

## Validation rules implemented

| Field | Rule | Enforced by |
|---|---|---|
| `exam_id` (create) | required | Zod `min(1)` + custom error display |
| `subject_id` | required | Zod `min(1)` + custom error display |
| `difficulty` | required, enum | Zod `enum` |
| `text` | min 10, max 2000 | Zod |
| `option_{a-d}` | min 1, max 500 per option | Zod per-field |
| `correct_key` | required, A/B/C/D | Zod `enum` |
| `explanation` | optional, max 1000 | Zod |
| `tags` | optional; split on comma; max 10; max 30 chars each enforced on submit | JS slice |
