# T029 — Test Paper Creation Page: Implementation Notes

## Files Created

| File | Role |
|---|---|
| `frontend/src/pages/teacher/TestPaperPage.tsx` | Page entry point — default export, owns all wizard state |
| `frontend/src/components/teacher/wizard/StepSettings.tsx` | Step 1: paper settings form (react-hook-form + Zod) |
| `frontend/src/components/teacher/wizard/StepSelectQuestions.tsx` | Step 2: question selector with checkbox Set management |
| `frontend/src/components/teacher/wizard/StepMarks.tsx` | Step 3: per-question marks table + submit |

No existing files were modified.

---

## Route

The page lives at `/teacher/test-papers`. Add it to `App.tsx` alongside the other teacher routes:

```tsx
import TestPaperPage from '@/pages/teacher/TestPaperPage'

// Inside <Routes>:
<Route path="/teacher/test-papers" element={<PrivateRoute><TestPaperPage /></PrivateRoute>} />
```

---

## Dependencies (all already installed)

All shadcn/ui components referenced are confirmed present in `frontend/src/components/ui/`:

`button`, `input`, `label`, `card`, `form`, `select`, `alert`, `badge`, `checkbox`, `table`, `progress`, `switch`, `separator`, `skeleton`, `scroll-area`, `tooltip`, `sonner`

No `npm install` required.

The `TooltipProvider` used in `StepSettings.tsx` must be mounted as an ancestor. If it is not already at the app root (`App.tsx`), add it there:

```tsx
import { TooltipProvider } from '@/components/ui/tooltip'
// Wrap the router or the entire app in <TooltipProvider delayDuration={300}>
```

---

## Wizard State Architecture

All state lives in `TestPaperPage` (no Zustand). Child steps receive only what they need via props.

```
TestPaperPage
├── step: 1 | 2 | 3
├── settingsData: PaperSettingsFormValues | null     (set when step 1 submits)
├── selectedIds: Set<string>                          (managed across step 2)
├── marksRows: MarksRowState[]                        (initialised at step 2→3 transition)
└── submitting: boolean                               (true during API calls)
```

### Step transitions

- **1 → 2**: `form.handleSubmit(onNext)` validates the Zod schema; on success stores `settingsData` and advances.
- **2 → 3**: button disabled until `selectedIds.size >= 1`; on click, derives `MarksRowState[]` from the selected questions (defaults: marks=4, negative_marks=1, display_order=index+1) and advances.
- **3 → submit**: calls `createTestPaper.mutateAsync` then `addQuestionsToPaper.mutateAsync` sequentially. On success: toast + reset wizard + navigate to `/teacher/exams`. On failure: shows inline Alert + toast.

---

## Form Schema (Step 1)

```ts
const settingsSchema = z.object({
  exam_id:                 z.string().min(1),
  title:                   z.string().min(3).max(200),
  duration:                z.coerce.number().int().min(1).max(360),   // minutes
  total_marks:             z.coerce.number().min(1),
  negative_marking_factor: z.coerce.number().min(0).max(4),           // default 0.25
  shuffle_questions:       z.boolean(),
  shuffle_options:         z.boolean(),
})
```

`duration` (minutes) is multiplied by 60 on submit to produce `duration_seconds` for the API.

---

## Question Filtering Strategy

Step 2 fetches **all questions** via `useQuestions({})`, then client-filters to only those whose `subject_id` belongs to the selected exam's subject list (from `useExamSubjects(examId)`). This avoids requiring the API to expose an `exam_id` filter on the questions endpoint, which does not exist in the current spec.

Additional client-side filtering (search text, subject, difficulty) runs inside `StepSelectQuestions` via `useMemo`.

---

## Assumptions

1. `useExams()` returns a `Paginated<Exam>` with `.items`; `useQuestions()` returns `Paginated<Question>` with `.items`. Both confirmed against existing hook implementations.
2. `useExamSubjects()` returns `Subject[]` directly (not paginated). Confirmed in `examsApi.listSubjects`.
3. `createTestPaper.mutateAsync(...)` returns a `TestPaper` object with `.id`. Confirmed against `testPapersApi.createForExam` return type.
4. `TooltipProvider` is expected at app root. The page does not mount its own provider to avoid nesting conflicts.
5. `sonner`'s `<Toaster>` is already mounted in `App.tsx` or `main.tsx`. The page calls `toast.*` without providing its own `<Toaster>`.
6. Navigation after successful creation goes to `/teacher/exams` (the natural next step: the new paper is now attached to that exam). Adjust in `TestPaperPage.tsx` L107 if a dedicated test-papers list route exists later.

---

## Accessibility Highlights

- `Progress` carries `aria-label="Step N of 3"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Active step label has `aria-current="step"`.
- "Select all" `Checkbox` in Step 2 uses `'indeterminate'` state for partial selection.
- Each row `Checkbox` has `aria-label="Select question: {first 60 chars}"`.
- `Switch` fields in Step 1 reference their `FormDescription` via `aria-describedby`.
- Marks inputs in Step 3 carry `aria-label="Marks for question N"` / `aria-label="Negative marks for question N"`.
- Submit button shows `aria-busy="true"` while submitting.
- Error alerts use `variant="destructive"` and appear above the Card so they are visible without scrolling.
- `aria-live="polite"` on the selection count badge region in Step 2.

---

## Testing

Run a Playwright flow against the running dev server:

1. Navigate to `/teacher/test-papers`.
2. Step 1: select an exam, fill title/duration/marks, advance.
3. Step 2: confirm questions appear, check a subset, advance (button enabled).
4. Step 3: edit marks on first row, click "Create Test Paper".
5. Assert toast "Test paper created" appears and page redirects to `/teacher/exams`.

Error path: submit with 0 questions selected → "Next: Set Marks" button is disabled.
