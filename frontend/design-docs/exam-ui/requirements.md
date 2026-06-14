# Exam-Taking UI — Requirements Document
## Tasks T036–T040

---

## 1. Feature Overview

Five tightly coupled components forming the student exam-taking experience:
an immersive full-screen exam shell, a question renderer with answer controls,
a colour-coded navigation palette, a countdown timer with auto-submit, and a
post-exam attempt-history page. All components are React 18 + Vite 5 SPA,
TypeScript strict, no `any`, react-router-dom routing, TanStack Query v5 for
server state, and an existing Zustand store for exam session state.

---

## 2. Installed shadcn Primitives (reuse — do not reinstall)

The following are confirmed present under `frontend/src/components/ui/`:

| Primitive | Used by |
|---|---|
| `alert` | ExamPage error state, AttemptsPage error state |
| `alert-dialog` | ExamPage submit confirmation |
| `badge` | QuestionDisplay difficulty badge (reuse DifficultyBadge), AttemptsPage status |
| `button` | All components |
| `card` | AttemptsPage row card pattern (optional), ExamPage layout |
| `checkbox` | (not used in exam UI) |
| `dialog` | (not used — alert-dialog covers confirmation) |
| `dropdown-menu` | (not used in exam UI) |
| `form` | (not used — no zod form in exam flow) |
| `input` | (not used in exam UI) |
| `label` | RadioGroup option labels |
| `progress` | Optional: exam progress bar in header |
| `radio-group` | QuestionDisplay option selection |
| `scroll-area` | QuestionPalette scrollable grid |
| `select` | (not used in exam UI) |
| `separator` | QuestionDisplay divider between question and options |
| `skeleton` | AttemptsPage loading state |
| `sonner` | Error/success toasts (already mounted in App.tsx) |
| `switch` | (not used in exam UI) |
| `table` | AttemptsPage history table |
| `textarea` | (not used in exam UI) |
| `tooltip` | QuestionPalette button tooltips, timer label |

---

## 3. New Components to Install

After registry validation against `@shadcn`:

**None required.**

Every UI need maps to an already-installed primitive or a plain Tailwind
composition. The question palette grid is a CSS grid of plain `<Button>`
elements with variant and colour overrides — there is no shadcn "grid palette"
component, and `toggle-group` would impose single-selection semantics that
conflict with independent per-question state. The countdown display is a
styled `<time>` element, not a library widget. Question images use a standard
`<img>` inside a constrained `<div>` — `aspect-ratio` would add a dependency
for something Tailwind's `aspect-*` classes already cover.

---

## 4. Component Specifications

---

### T036 — ExamPage
**File:** `src/pages/exam/ExamPage.tsx`
**Route:** `/exam/:attemptId` (add to `App.tsx` inside `<PrivateRoute>`)

#### Purpose
Immersive full-screen exam shell. Owns the mount-time server fetch, syncs
the Zustand store, manages the full-screen browser API, and houses the submit
confirmation gate. Does NOT use `TeacherPageShell` — it renders its own
minimal chrome.

#### Components Required

| Component | Source | Role |
|---|---|---|
| `Button` | `@/components/ui/button` | Full-screen toggle, Submit trigger |
| `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` | `@/components/ui/alert-dialog` | Submit confirmation modal |
| `Alert`, `AlertDescription` | `@/components/ui/alert` | Fetch-error state |
| `Skeleton` | `@/components/ui/skeleton` | Initial load skeleton for the shell |
| `Progress` | `@/components/ui/progress` | Optional: answered-of-total bar in header |
| `Separator` | `@/components/ui/separator` | Vertical divider between question area and palette |
| `ExamTimer` | `@/components/exam/ExamTimer` | Timer widget in header |
| `QuestionDisplay` | `@/components/exam/QuestionDisplay` | Main question + options panel |
| `QuestionPalette` | `@/components/exam/QuestionPalette` | Side panel grid |
| `useExamSessionStore` | `@/store/examSessionStore` | All session state |
| `useAttempt` | `@/hooks/useAttempts` | Server fetch on mount |
| `useSubmitAttempt` | `@/hooks/useAttempts` | Mutation on confirm |
| `useParams`, `useNavigate` | `react-router-dom` | Route param + post-submit redirect |

#### Component Hierarchy

```
ExamPage
├── <header>  (sticky, minimal chrome)
│   ├── <span> test paper title
│   ├── Progress  [answered / total, optional]
│   ├── ExamTimer
│   └── Button "Submit"  → opens AlertDialog
├── <main>  (flex row, fills remaining viewport height)
│   ├── <section>  (flex-1, overflow-y-auto)  — question area
│   │   └── QuestionDisplay
│   └── <aside>  (fixed-width ~280px, overflow-y-auto)  — palette
│       ├── Separator (vertical, hidden on mobile)
│       └── QuestionPalette
└── AlertDialog  (submit confirmation, portal)
    └── AlertDialogContent
        ├── AlertDialogHeader
        │   ├── AlertDialogTitle  "Submit exam?"
        │   └── AlertDialogDescription  (unanswered count summary)
        └── AlertDialogFooter
            ├── AlertDialogCancel  "Continue exam"
            └── AlertDialogAction  "Submit now"  → useSubmitAttempt
```

#### State and Data Flow

1. `useParams()` extracts `attemptId`.
2. `useAttempt(attemptId)` fires on mount (`staleTime: Infinity`). On success,
   call `syncFromServer(data)` to populate the Zustand store. Show skeleton
   while loading; show `Alert` variant `destructive` on error.
3. All subsequent reads come from `useExamSessionStore` selectors — never
   re-query during the exam.
4. Submit flow: Button click → set local `submitOpen` state → `AlertDialog`
   opens. In `AlertDialogDescription`, derive unanswered count from
   `questions.length - Object.values(localAnswers).filter(Boolean).length`.
   On confirm → `useSubmitAttempt().mutate(attemptId)` → on success
   `navigate(\`/analysis/${attemptId}\`)` + `reset()` store.
5. Full-screen toggle: `document.documentElement.requestFullscreen()` /
   `document.exitFullscreen()`, gated by `document.fullscreenEnabled`. Track
   `isFullscreen` in `useState<boolean>`.
6. On unmount (navigation away without submit), call `store.setPaused(true)`
   to freeze the timer.

#### Accessibility

- `<main>` has `role="main"` and `aria-label="Exam: {testPaper.title}"`.
- Submit `Button` has `aria-haspopup="dialog"`.
- `AlertDialog` uses the shadcn built-in focus trap and `aria-modal="true"`.
- Full-screen button: `aria-label` toggles between "Enter full screen" and
  "Exit full screen".
- Keyboard: Escape exits full screen (browser native); Escape also closes
  `AlertDialog` via Radix default.

#### Interaction Notes

- Mobile layout: palette collapses below question area (flex-col on small
  screens), or behind a Drawer (not required for T036; can be deferred).
- Prevent accidental navigation: add `beforeunload` listener that warns if
  `attemptId` is set and attempt is not yet submitted.

---

### T037 — QuestionDisplay
**File:** `src/components/exam/QuestionDisplay.tsx`

#### Purpose
Renders the current question (text, optional image, difficulty, question
counter) and its four options as a `RadioGroup`. Houses the four action
buttons: Previous, Mark for Review, Clear Response, Next.

#### Components Required

| Component | Source | Role |
|---|---|---|
| `RadioGroup`, `RadioGroupItem` | `@/components/ui/radio-group` | Option selection |
| `Label` | `@/components/ui/label` | Option text labels bound to `RadioGroupItem` |
| `Button` | `@/components/ui/button` | Previous / Next / Mark / Clear |
| `Badge` | `@/components/ui/badge` | Difficulty badge (delegate to existing `DifficultyBadge`) |
| `Separator` | `@/components/ui/separator` | Divides question stem from options |
| `DifficultyBadge` | `@/components/teacher/DifficultyBadge` | Reuse existing component |
| `useExamSessionStore` | `@/store/examSessionStore` | Read question + answers; call actions |
| `useSaveAnswer` | `@/hooks/useAttempts` | Persist answer mutation (optimistic) |

#### Component Hierarchy

```
QuestionDisplay
├── <header>  (question meta row)
│   ├── <span>  "Question {currentIndex + 1} of {questions.length}"
│   └── DifficultyBadge  difficulty={question.difficulty}
├── <div>  (question stem)
│   ├── <p>  question.text
│   └── <img>  (conditional, question.image_url)
│       — constrained with Tailwind max-h-64 object-contain
├── Separator
├── RadioGroup  (options A–D)
│   └── [×4]  <div>  (option row, hover highlight)
│       ├── RadioGroupItem  id={option.id}  value={option.id}
│       ├── Label  htmlFor={option.id}
│       │   ├── <span>  option.option_key  (A/B/C/D chip)
│       │   ├── <span>  option.text
│       │   └── <img>  (conditional, option.image_url)
│       └── — entire row is clickable via Label
└── <footer>  (action button row)
    ├── Button variant="outline"  "Previous"  onClick={prevQuestion}
    │   disabled={currentIndex === 0}
    ├── Button variant="outline"  "Mark for Review"
    │   — toggled style when markedForReview[question.id]
    ├── Button variant="ghost"  "Clear Response"
    │   disabled={!localAnswers[question.id]}
    │   onClick={setAnswer(question.id, null)}
    └── Button  "Next"  onClick={nextQuestion}
        disabled={currentIndex === questions.length - 1}
```

#### State and Data Flow

```
useExamSessionStore selectors:
  questions, currentIndex, localAnswers, markedForReview
  → setAnswer, markForReview, nextQuestion, prevQuestion

useSaveAnswer() mutation:
  On RadioGroup onValueChange(optionId):
    1. setAnswer(question.id, optionId)          // optimistic, synchronous
    2. useSaveAnswer().mutate({
         attemptId,
         data: {
           question_id: question.id,
           selected_option_id: optionId,
         }
       })
  On "Clear Response":
    1. setAnswer(question.id, null)
    2. useSaveAnswer().mutate({
         attemptId,
         data: { question_id: question.id, selected_option_id: null }
       })
  On "Mark for Review":
    1. markForReview(question.id)
    2. useSaveAnswer().mutate({
         attemptId,
         data: {
           question_id: question.id,
           is_marked_for_review: !markedForReview[question.id]
         }
       })
```

Props accepted: `{ attemptId: string }` — the component reads everything else
from the store and the mutation hook.

#### Accessibility

- `RadioGroup` gets `aria-label="Answer options for question {currentIndex + 1}"`.
- Each `RadioGroupItem` is a native radio; keyboard navigation (arrow keys)
  works by default via Radix.
- Question image: `alt="Question {currentIndex + 1} diagram"` (or empty string
  if decorative — flag in implementation review).
- Option image: `alt="Option {option.option_key} diagram"`.
- "Mark for Review" button: `aria-pressed={markedForReview[question.id]}` to
  convey toggle state to assistive technology.
- "Clear Response" button: `aria-disabled` when no answer is selected (rather
  than removing from DOM) so screen reader users know it exists.
- Footer buttons are in a `<div role="group" aria-label="Question navigation">`.

#### Interaction Notes

- Option row background: `bg-primary/10 border-primary` when that option is
  selected; `hover:bg-muted/50` otherwise. Applied via `cn()` — no extra
  shadcn primitive needed.
- "Mark for Review" button visual state: `variant="outline"` with
  `className="border-amber-400 text-amber-700 bg-amber-50"` when active.
- Save-answer mutation errors should `toast.error(...)` via sonner — do not
  block the UI (the local state is already updated optimistically).

---

### T038 — QuestionPalette
**File:** `src/components/exam/QuestionPalette.tsx`

#### Purpose
Scrollable grid of numbered buttons (1..N) colour-coded by question status.
Clicking navigates directly to that question. Includes a small status legend.

#### Components Required

| Component | Source | Role |
|---|---|---|
| `Button` | `@/components/ui/button` | Each numbered palette cell |
| `ScrollArea` | `@/components/ui/scroll-area` | Scroll container for large question sets |
| `Tooltip`, `TooltipContent`, `TooltipTrigger` | `@/components/ui/tooltip` | Status label on hover (e.g. "Q12 — Answered") |
| `Separator` | `@/components/ui/separator` | Between grid and legend |
| `useExamSessionStore` | `@/store/examSessionStore` | questions, currentIndex, localAnswers, markedForReview, goToQuestion |
| `questionStatus` | `@/store/examSessionStore` | Derive colour per question |

#### Component Hierarchy

```
QuestionPalette
├── <header>  (section label + summary counts)
│   └── <p>  "Question Palette"  +  answered count chips
├── ScrollArea  (fills available height)
│   └── <div>  CSS grid  grid-cols-5 gap-1.5
│       └── [×N]  TooltipProvider > Tooltip
│           ├── TooltipTrigger  asChild
│           │   └── Button  (palette cell)
│           │       — size="sm", variant computed from status
│           └── TooltipContent
│               └── <p>  "Q{i+1} — {status label}"
├── Separator
└── <footer>  (legend)
    └── <div>  (4-item flex row)
        ├── LegendItem  colour=grey    label="Unanswered"
        ├── LegendItem  colour=green   label="Answered"
        ├── LegendItem  colour=amber   label="Marked"
        └── LegendItem  colour=purple  label="Answered + Marked"
```

`LegendItem` is a small local presentational component (not a shadcn
primitive): a coloured 10×10px square + text.

#### Colour Mapping (applied via `cn()` + Tailwind)

| Status | Button classes |
|---|---|
| `unanswered` | `bg-muted text-muted-foreground hover:bg-muted/80` |
| `answered` | `bg-emerald-500 text-white hover:bg-emerald-600` |
| `marked` | `bg-amber-400 text-white hover:bg-amber-500` |
| `answered-marked` | `bg-purple-500 text-white hover:bg-purple-600` |
| current question | add `ring-2 ring-primary ring-offset-1` to any status |

#### State and Data Flow

```
useExamSessionStore selectors:
  questions, currentIndex, localAnswers, markedForReview, goToQuestion

Per render, for each question index i:
  status = questionStatus(questions[i].id, localAnswers, markedForReview)
  isCurrent = (i === currentIndex)
  → derive button className from status + isCurrent
  → onClick: goToQuestion(i)
```

Props: none — reads entirely from store.

#### Accessibility

- Grid container: `role="group" aria-label="Question navigation palette"`.
- Each Button: `aria-label="Question {i+1}, {statusLabel}"` so screen readers
  announce both number and status without relying on colour.
- `aria-current="true"` on the current question button.
- `TooltipContent` is `aria-hidden="true"` (visual enhancement only, since the
  `aria-label` already conveys the same info).
- `ScrollArea` preserves native scroll for keyboard users; no scrollbar-only
  dependency.

#### Interaction Notes

- On small screens (exam page mobile layout), this component is either
  collapsed into an accordion or shown in a bottom drawer. T038 itself only
  needs to render the grid; the ExamPage decides how to position it.
- Summary counts in the header (e.g. "42 answered, 5 marked") are derived
  inline — no additional hook needed.

---

### T039 — ExamTimer
**File:** `src/components/exam/ExamTimer.tsx`

#### Purpose
Counts down from `durationSeconds - timeElapsedSeconds`. Drives `tick()` on a
1-second interval. Displays HH:MM:SS; turns red under 5 minutes. On reaching
zero, auto-submits and redirects.

#### Components Required

| Component | Source | Role |
|---|---|---|
| `Button` | `@/components/ui/button` | (optional) pause/resume in dev/proctored mode |
| `Tooltip`, `TooltipContent`, `TooltipTrigger` | `@/components/ui/tooltip` | "Time remaining" label for icon-only display mode |
| `useExamSessionStore` | `@/store/examSessionStore` | `timeElapsedSeconds`, `isPaused`, `tick`, `testPaper` |
| `useSubmitAttempt` | `@/hooks/useAttempts` | Auto-submit mutation |
| `useNavigate` | `react-router-dom` | Redirect after auto-submit |

No shadcn primitive owns the display itself — the HH:MM:SS string is rendered
in a styled `<time>` element with a `dateTime` ISO-duration attribute.

#### Component Hierarchy

```
ExamTimer
└── <div>  (timer wrapper, inline-flex, items-center, gap-2)
    ├── <ClockIcon>  (lucide-react, h-4 w-4, aria-hidden)
    └── <time>
        dateTime={isoDuration}
        aria-live="polite"
        aria-label="Time remaining: {humanReadable}"
        className — conditionally adds text-red-600 font-bold
                     when remainingSeconds < 300
        └── {HH:MM:SS formatted string}
```

Props: `{ attemptId: string; onExpire?: () => void }`

#### State and Data Flow

```
const { timeElapsedSeconds, isPaused, tick, testPaper } =
  useExamSessionStore(s => ({...}))

remainingSeconds = (testPaper?.durationSeconds ?? 0) - timeElapsedSeconds

useEffect(() => {
  if (remainingSeconds <= 0) {
    // auto-submit
    submitMutation.mutate(attemptId, {
      onSuccess: () => {
        reset()
        navigate(`/analysis/${attemptId}`)
      }
    })
    return
  }
  const id = setInterval(() => { tick() }, 1000)
  return () => clearInterval(id)
}, [remainingSeconds <= 0, isPaused])
```

The interval is torn down when `isPaused` is true (guard inside `tick` already
handles this, but clearing the interval avoids unnecessary calls).

#### Accessibility

- `<time aria-live="polite">` announces the time to screen readers at a polite
  priority. It must NOT be `aria-live="assertive"` — that would announce every
  single second.
- The live region is updated once per minute (change the displayed string only
  when the minute value changes) OR keep second-level updates but ensure the
  text string doesn't change format (screen readers often debounce rapid
  live-region updates naturally).
- When time turns critical (<5 min), a single assertive announcement is made
  via a visually-hidden `<div aria-live="assertive" aria-atomic="true">` that
  is populated once with "Warning: less than 5 minutes remaining" and then
  cleared.
- `aria-label` on `<time>` provides a human-readable label independent of the
  visual text, e.g. "1 hour 23 minutes 45 seconds remaining".

#### Interaction Notes

- Under 5 minutes: `text-red-600 font-bold` on `<time>`, ClockIcon switches to
  `text-red-600`.
- Under 1 minute: consider adding a `animate-pulse` class for urgency cue.
- Auto-submit failure: show `toast.error("Auto-submit failed. Please submit
  manually.")` via sonner and do NOT reset the timer — let the user retry the
  submit button in ExamPage.

---

### T040 — AttemptsPage
**File:** `src/pages/student/AttemptsPage.tsx`
**Route:** `/attempts` (add to `App.tsx` inside `<PrivateRoute>`)

#### Purpose
Student exam history. Displays all own attempts in a table with status badge,
score, rank, percentile, and a link to the analysis page. Uses the standard
page shell (analogous to TeacherPageShell — can reuse it or build a thin
StudentPageShell). Loading skeletons + empty state.

#### Components Required

| Component | Source | Role |
|---|---|---|
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | `@/components/ui/table` | History table |
| `Badge` | `@/components/ui/badge` | Attempt status (submitted / in_progress / timed_out) |
| `Skeleton` | `@/components/ui/skeleton` | Row-level loading placeholders |
| `Alert`, `AlertDescription` | `@/components/ui/alert` | Error state |
| `Button` | `@/components/ui/button` | "View Analysis" link button |
| `Link` | `react-router-dom` | Navigate to `/analysis/:attemptId` |
| `TeacherPageShell` | `@/components/teacher/TeacherPageShell` | Reuse existing shell (rename candidate: PageShell) |
| `useAttemptsList` | `@/hooks/useAttempts` | Fetch attempt history |

#### Component Hierarchy

```
AttemptsPage
└── TeacherPageShell  title="My Attempts"  description="Your exam history"
    ├── — loading state —
    │   └── <div aria-busy="true" aria-label="Loading attempts">
    │       └── [×5]  AttemptRowSkeleton  (local component)
    │           — mirrors the table row structure with Skeleton cells
    ├── — error state —
    │   └── Alert variant="destructive"
    │       └── AlertDescription  "Failed to load attempt history..."
    ├── — empty state —
    │   └── <div>  (dashed border, centered, py-16)
    │       ├── <p>  "No attempts yet"
    │       └── <p>  "Complete a test to see your history here."
    └── — data state —
        └── Table
            ├── TableHeader
            │   └── TableRow
            │       ├── TableHead  "Test Paper"
            │       ├── TableHead  "Date"
            │       ├── TableHead  "Status"
            │       ├── TableHead  "Score"
            │       ├── TableHead  "Rank"
            │       ├── TableHead  "Percentile"
            │       └── TableHead  "Actions"
            └── TableBody
                └── [×N]  TableRow  key={attempt.id}
                    ├── TableCell  {testPaper title — requires join or separate fetch}
                    ├── TableCell  {formatted started_at date}
                    ├── TableCell  <StatusBadge status={attempt.status} />
                    ├── TableCell  {attempt.final_score ?? "—"}
                    ├── TableCell  {attempt.rank ?? "—"}
                    ├── TableCell  {attempt.percentile != null
                                      ? `${attempt.percentile.toFixed(1)}%`
                                      : "—"}
                    └── TableCell
                        └── Button variant="outline" size="sm" asChild
                            └── Link to={`/analysis/${attempt.id}`}
                                "View Analysis"
```

`StatusBadge` is a small local component (not shadcn) mapping status strings
to `Badge` variants:

| Status | Badge variant / className |
|---|---|
| `submitted` | `default` (primary) |
| `in_progress` | `secondary` + amber tint |
| `timed_out` | `destructive` |

#### State and Data Flow

```
const { data, isLoading, isError } = useAttemptsList()

data: AttemptSummary[]  (from @/types/attempt)

AttemptSummary fields used:
  id, test_paper_id, status, started_at, submitted_at,
  final_score, rank, percentile

Note: AttemptSummary does not carry test_paper title.
Two options:
  A) API includes it (check api-endpoints.md — preferred)
  B) Add test_paper_title to AttemptSummary type + backend response,
     or do a secondary lookup via useTestPapers() and join client-side.
Flag this as an implementation decision for the builder.
```

#### Accessibility

- `Table` renders semantic `<table>` — assistive technologies announce it
  correctly.
- `TableHead` cells map to `<th scope="col">` (shadcn default).
- Badge colour alone does not convey status — the text label inside the badge
  is the primary conveyor.
- Loading region: `aria-busy="true"` + `aria-label` on the container.
- Empty state paragraph is in `<p>` elements, not headings.
- "View Analysis" links: include the attempt context in the label when multiple
  rows exist — use `aria-label="View analysis for attempt on {date}"` on the
  Button/Link.

#### Interaction Notes

- Date formatting: use `Intl.DateTimeFormat` (no external date library needed).
- Sort order: most recent first (API should return sorted; if not, sort by
  `started_at` descending client-side).
- `TeacherPageShell` is currently named for teachers but is actually a generic
  shell. Consider renaming to `PageShell` as a clean-up task — not in scope
  for T040, but flag it.

---

## 5. App.tsx Route Additions

Two new `<Route>` entries are needed inside the existing `<Routes>`:

```tsx
// Exam (immersive — no shell)
<Route
  path="/exam/:attemptId"
  element={
    <PrivateRoute>
      <ExamPage />
    </PrivateRoute>
  }
/>

// Student attempt history
<Route
  path="/attempts"
  element={
    <PrivateRoute>
      <AttemptsPage />
    </PrivateRoute>
  }
/>
```

---

## 6. Data Flow — Consolidated Cross-Component View

```
URL param :attemptId
    |
    v
ExamPage (mount)
    |
    |-- useAttempt(attemptId)  [TanStack Query, staleTime: Infinity]
    |       |
    |       v  AttemptState from server
    |   syncFromServer()  →  Zustand store populated
    |
    |-- [store read] → ExamTimer  (timeElapsedSeconds, durationSeconds)
    |       |
    |       |-- tick() every 1s  →  store.timeElapsedSeconds++
    |       |-- on expire  →  useSubmitAttempt().mutate()
    |
    |-- [store read] → QuestionDisplay  (questions[currentIndex], localAnswers, markedForReview)
    |       |
    |       |-- RadioGroup change  →  setAnswer() + useSaveAnswer().mutate()
    |       |-- markForReview()   →  store + useSaveAnswer().mutate()
    |       |-- nextQuestion() / prevQuestion()  →  store only
    |
    |-- [store read] → QuestionPalette  (questions, currentIndex, localAnswers, markedForReview)
            |
            └-- goToQuestion(i)  →  store only
```

Server mutations (`useSaveAnswer`, `useSubmitAttempt`) are fire-and-forget
from the UI perspective. Local store is the source of truth during the exam.

---

## 7. Directory Structure After Implementation

```
frontend/src/
├── components/
│   └── exam/
│       ├── ExamTimer.tsx          (T039)
│       ├── QuestionDisplay.tsx    (T037)
│       └── QuestionPalette.tsx    (T038)
├── pages/
│   ├── exam/
│   │   └── ExamPage.tsx           (T036)
│   └── student/
│       └── AttemptsPage.tsx       (T040)
```

---

## 8. Consolidated "Components to Install" List

**No new shadcn components need to be installed.**

All UI needs are covered by the 19 already-installed primitives. Specifically:

- Question palette grid: plain `<Button>` in a CSS grid with Tailwind colour
  overrides. No `toggle-group` needed.
- Timer display: `<time>` element with Tailwind classes. No timer widget needed.
- Question images: `<img>` with Tailwind `aspect-video` / `object-contain`.
  No `aspect-ratio` component needed.
- Exam shell layout: Tailwind flex/grid layout utilities. No layout component
  needed.

---

## 9. Open Implementation Decisions (Flag for Builder)

1. **AttemptSummary missing test_paper title**: `AttemptSummary` type has only
   `test_paper_id`. Either extend the API response or join with a separate
   `useTestPapers()` call. Check `docs/specifications/api-endpoints.md` before
   choosing. Preferred: extend the API response to include `test_paper_title`.

2. **Mobile palette placement**: T038 spec delivers the grid component; T036
   decides whether to show it inline (below question on mobile) or in a drawer.
   A Drawer component (not currently installed) would be clean; an
   `overflow-x-auto` scroll strip is a zero-dependency alternative. Defer the
   decision to T036 implementation.

3. **TeacherPageShell rename**: It is a generic shell. Rename to `PageShell`
   as a follow-up clean-up task, not inside T040.

4. **Analysis route**: ExamTimer and ExamPage both redirect to
   `/analysis/:attemptId` on submit. That route/page is not yet registered
   in `App.tsx`. Ensure the analysis page task (T041+) adds it, or add a
   placeholder redirect to `/dashboard` in the interim.

5. **beforeunload warning**: The browser's `beforeunload` dialog cannot be
   customised in modern browsers — it shows a generic message. Implement it
   anyway for the UX safety net.
