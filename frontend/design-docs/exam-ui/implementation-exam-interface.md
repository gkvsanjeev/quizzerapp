# Exam Interface Implementation (T036–T039)

## Files Created

| File | Task | Description |
|---|---|---|
| `src/pages/exam/ExamPage.tsx` | T036 | Immersive exam shell with timer, palette, submit dialog |
| `src/components/exam/QuestionDisplay.tsx` | T037 | Question renderer with RadioGroup and action buttons |
| `src/components/exam/QuestionPalette.tsx` | T038 | Colour-coded navigation grid in a ScrollArea |
| `src/components/exam/ExamTimer.tsx` | T039 | Countdown timer with auto-submit and critical warning |

## Route Wiring (App.tsx — manual step)

Add these two routes inside `<Routes>` in `src/App.tsx`:

```tsx
import ExamPage from '@/pages/exam/ExamPage'

<Route
  path="/exam/:attemptId"
  element={
    <PrivateRoute>
      <ExamPage />
    </PrivateRoute>
  }
/>
```

## Key Design Decisions

### 1. Timer isolation (performance critical)
`ExamTimer` is the sole subscriber to `timeElapsedSeconds`. The `useEffect` interval
is defined with the dependency `[remaining <= 0, isPaused, tick]`, where
`remaining <= 0` is a boolean — so the effect only re-runs when the exam transitions
from running → expired or paused/resumed. `ExamPage` and `QuestionDisplay` never
subscribe to `timeElapsedSeconds`, eliminating 1 re-render per second on the
two heaviest components.

### 2. Auto-submit guard
`ExamTimer` uses a `hasSubmittedRef` (initialised `false`) to ensure `mutate` fires
exactly once when `remaining` reaches 0. The `onExpire` callback prop lets `ExamPage`
own the mutation and navigation logic, keeping the timer purely presentational.

### 3. syncFromServer guard
`ExamPage` keys the sync `useEffect` on `data?.attempt_id` (not on `data` itself),
so re-renders caused by query cache updates do not repeatedly overwrite the user's
in-progress answers.

### 4. Fine-grained Zustand selectors
Every `useExamSessionStore` call uses a single-value selector:
```tsx
const currentIndex = useExamSessionStore(s => s.currentIndex)
```
This avoids object identity churn from fat selectors and prevents unnecessary
re-renders.

### 5. AlertDialogDescription constraint
shadcn's `AlertDialogDescription` wraps `@radix-ui/react-alert-dialog`'s
`Description` primitive, which does not expose an `asChild` prop. Inline JSX
with `<span className="block">` inside the description string is used instead.

### 6. Mobile palette
On small screens (`< md`), the aside is hidden and a `<details>` / `<summary>`
collapsible at the bottom of the page exposes `QuestionPalette`. No extra shadcn
component (Drawer) is needed; the zero-dependency `<details>` pattern matches
the spec's guidance.

### 7. Dwell time tracking
`QuestionDisplay` stores a `questionShownAtRef` timestamp. On every `currentIndex`
change the timestamp resets. When an answer is saved or cleared, the delta is
calculated and passed as `time_spent_delta_seconds` to `useSaveAnswer`.

### 8. Accessibility summary
- `<main role="main" aria-label="Exam: {title}">` on the exam body.
- `<time aria-live="polite" aria-label="{human readable}">` on the countdown.
- Assertive live region fires once when remaining < 5 min.
- `<RadioGroup aria-label="Answer options for question N">` on options.
- `aria-pressed` on "Mark for Review" button conveys toggle state.
- `role="group" aria-label="Question navigation palette"` on the palette grid.
- `aria-label="Question {i+1}, {statusLabel}"` + `aria-current` on each palette button.
- `aria-haspopup="dialog"` on the Submit button.
- Full-screen button `aria-label` toggles between "Enter full screen" / "Exit full screen".

## Dependencies

All shadcn primitives used are already installed:

| Primitive | Import path |
|---|---|
| `AlertDialog` family | `@/components/ui/alert-dialog` |
| `Alert`, `AlertDescription` | `@/components/ui/alert` |
| `Badge` (via DifficultyBadge) | `@/components/teacher/DifficultyBadge` |
| `Button` | `@/components/ui/button` |
| `Progress` | `@/components/ui/progress` |
| `RadioGroup`, `RadioGroupItem` | `@/components/ui/radio-group` |
| `ScrollArea` | `@/components/ui/scroll-area` |
| `Separator` | `@/components/ui/separator` |
| `Skeleton` | `@/components/ui/skeleton` |
| `Tooltip` family | `@/components/ui/tooltip` |
| `Label` | `@/components/ui/label` |

External: `lucide-react` (Clock, Maximize2, Minimize2, AlertTriangle) — already a
dependency of shadcn/ui.

## Store & Hooks Contract

The implementation reads from these contracts exactly as documented:

```
useExamSessionStore — @/store/examSessionStore
  State: attemptId, testPaper, questions, currentIndex,
         localAnswers, markedForReview, timeElapsedSeconds, isPaused
  Actions: syncFromServer, setAnswer, markForReview, nextQuestion,
           prevQuestion, goToQuestion, tick, setPaused, reset

questionStatus(qid, localAnswers, markedForReview) — helper export

useAttempt(attemptId)        — @/hooks/useAttempts
useSaveAnswer()              — @/hooks/useAttempts
useSubmitAttempt()           — @/hooks/useAttempts
```

## TypeScript

- No `any` types used anywhere.
- `AttemptResult`, `AttemptState`, `QuestionStudent`, `OptionStudent` from `@/types/attempt`.
- `Difficulty`, `OptionKey` from `@/types/question` (via DifficultyBadge).
- `QuestionStatus` type imported from `@/store/examSessionStore`.
