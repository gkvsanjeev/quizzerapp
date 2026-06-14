# Teacher Console UI — shadcn/ui Requirements

**Scope:** T027 (Exam Management), T028 (Question Bank), T029 (Test Paper Creation)
**Stack:** React 18 + Vite 5 + TypeScript strict · react-router-dom · TanStack Query v5 · react-hook-form + zod · shadcn/ui (default style, slate base, CSS variables)
**RSC:** false — no `"use client"`, no `next/*` imports anywhere.

---

## Legend

- [installed] — already present in `frontend/src/components/ui/`
- [needs-install] — confirmed in `@shadcn` registry; must be added with `npx shadcn@latest add <name>`

---

## Shared Layout: TeacherPageShell

### Purpose
A reusable wrapper used by all three teacher pages. Keeps header, breadcrumb, and page-level action slot consistent so individual pages only own their content area.

### Props interface
```ts
interface TeacherPageShellProps {
  title: string
  description?: string
  action?: React.ReactNode   // e.g. "Create Exam" button
  children: React.ReactNode
}
```

### Component Hierarchy
```
TeacherPageShell
├── <header> (sticky, border-b, bg-background/95 backdrop-blur)
│   ├── Separator [needs-install]          (visual left-border accent)
│   ├── <h1> page title
│   ├── <p> description (text-muted-foreground)
│   └── action slot (Button [installed])
└── <main> (flex-1 overflow-auto p-6)
    └── {children}
```

### File
`frontend/src/components/teacher/TeacherPageShell.tsx`

---

## T027 — Exam Management Page

### Feature Name
ExamsPage — teacher view of all exams with inline subject management and exam creation.

**Route:** `/teacher/exams`
**File:** `frontend/src/pages/teacher/ExamsPage.tsx`

---

### Components Required

| Component | Source | Status | Purpose |
|---|---|---|---|
| `Button` | @shadcn/ui | [installed] | "Create Exam" trigger, "Add Subject" inline CTA, dialog actions |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | @shadcn/ui | [installed] | Per-exam card in the list |
| `Input` | @shadcn/ui | [installed] | Subject name input (inline); search in dialog |
| `Label` | @shadcn/ui | [installed] | Form field labels |
| `Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage` | @shadcn/ui | [installed] | Wraps react-hook-form fields in Create Exam dialog |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | @shadcn/ui | [installed] | exam_type picker in Create Exam dialog |
| `Alert`, `AlertDescription` | @shadcn/ui | [installed] | Empty state when no exams exist |
| `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` | @shadcn/ui | [needs-install] | "Create Exam" modal |
| `Badge` | @shadcn/ui | [needs-install] | Published/draft status pill; subject name chips |
| `Skeleton` | @shadcn/ui | [needs-install] | Loading state for exam card grid |
| `Separator` | @shadcn/ui | [needs-install] | Visual divider within exam card (title / subjects section) |
| `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | @shadcn/ui | [needs-install] | "Add Subject" icon button label; topic names on hover |
| `Sonner` (toast) | @shadcn/ui | [needs-install] | Success / error feedback on create exam, add subject |

---

### Component Hierarchy

```
ExamsPage
├── TeacherPageShell (title="Exams", action=<CreateExamDialogTrigger>)
│   └── main
│       ├── [loading] ExamCardSkeleton × 3
│       │   └── Skeleton (card shape)
│       ├── [empty] Alert + AlertDescription + Button ("Create your first exam")
│       └── [data] exam card grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4)
│           └── ExamCard (per Exam)
│               ├── Card
│               │   ├── CardHeader
│               │   │   ├── <h3> title
│               │   │   └── Badge (Published | Draft)
│               │   ├── CardContent
│               │   │   ├── <p> description (truncate, text-muted-foreground)
│               │   │   ├── <span> exam_type chip (text-xs bg-slate-100)
│               │   │   ├── Separator
│               │   │   └── SubjectList
│               │   │       ├── [subjects] Badge × N (subject name, variant=secondary)
│               │   │       │   └── Tooltip → topic names
│               │   │       └── AddSubjectInline
│               │   │           ├── Input (subject name)
│               │   │           └── Button (icon: Plus, size=sm)
│               │   └── CardFooter
│               │       └── <span> created_at (text-xs text-muted-foreground)
│
└── CreateExamDialog (controlled by dialogOpen: boolean)
    └── Dialog
        └── DialogContent
            └── DialogHeader + DialogTitle ("New Exam")
            └── Form (react-hook-form, zod schema)
                ├── FormField → title → Input
                ├── FormField → exam_type → Select
                │   └── SelectContent: JEE | NEET | UPSC | GATE | Other
                ├── FormField → description → Textarea [needs-install]
                └── DialogFooter
                    ├── Button (variant=outline, "Cancel")
                    └── Button (type=submit, "Create Exam", loading state)
```

---

### State and Data Flow

**Server state (TanStack Query):**
- `useExams()` — fetches `Paginated<Exam>` for the card grid; `queryKey: examKeys.list({})`
- `useCreateExam()` — mutation; on success: invalidates `examKeys.all`, fires `toast.success`
- `useExamSubjects(examId)` — per-card lazy fetch; `enabled: Boolean(examId)`, `queryKey: examKeys.subjects(examId)`
- `useCreateSubject()` — mutation; on success: invalidates `examKeys.subjects(examId)`, fires `toast.success`

**Local state (useState):**
```ts
const [dialogOpen, setDialogOpen] = useState(false)
// per-card inline subject input — managed inside ExamCard component
const [subjectInput, setSubjectInput] = useState('')
const [addingSubject, setAddingSubject] = useState(false)
```

**Form (react-hook-form + zod):**
```ts
const examSchema = z.object({
  title:       z.string().min(3, 'At least 3 characters'),
  exam_type:   z.string().min(1, 'Select a type'),
  description: z.string().optional(),
})
```
Submit calls `createExam.mutateAsync(data)`, then `setDialogOpen(false)` and `form.reset()`.

---

### Accessibility Requirements

- Dialog traps focus via Radix Dialog primitives (built into shadcn Dialog).
- `DialogTitle` always present (required for `aria-labelledby`).
- Badge color alone does not convey published state — always pair with text ("Published" / "Draft").
- "Add Subject" Button renders with `aria-label="Add subject to {exam title}"`.
- Skeleton cards include `aria-busy="true"` on the containing grid during load.
- Tooltip content is duplicated in `aria-label` on the trigger so keyboard/screen-reader users get topic names without hover.

---

### Validation Rules

| Field | Rule |
|---|---|
| `title` | required, min 3 chars, max 120 chars |
| `exam_type` | required, non-empty string |
| `description` | optional, max 500 chars |
| Subject `name` | required, min 2 chars — validated inline before calling mutation |

---

## T028 — Question Bank Page

### Feature Name
QuestionBankPage — filterable, searchable question list with full CRUD via a dialog form.

**Route:** `/teacher/questions`
**File:** `frontend/src/pages/teacher/QuestionBankPage.tsx`

---

### Components Required

| Component | Source | Status | Purpose |
|---|---|---|---|
| `Button` | @shadcn/ui | [installed] | "Add Question", edit/delete row actions, dialog submit/cancel |
| `Input` | @shadcn/ui | [installed] | Free-text search filter |
| `Label` | @shadcn/ui | [installed] | Filter labels, form labels |
| `Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage` | @shadcn/ui | [installed] | Wraps all react-hook-form fields in question form |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | @shadcn/ui | [installed] | Subject filter, difficulty filter/field, subject picker in form |
| `Alert`, `AlertDescription` | @shadcn/ui | [installed] | Empty state when filter returns no results |
| `Card`, `CardContent` | @shadcn/ui | [installed] | Filter panel container |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` | @shadcn/ui | [needs-install] | Add / Edit question form modal |
| `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` | @shadcn/ui | [needs-install] | Delete confirmation dialog |
| `Badge` | @shadcn/ui | [needs-install] | Color-coded difficulty pill (easy=green, medium=amber, hard=red) |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | @shadcn/ui | [needs-install] | Question list |
| `Textarea` | @shadcn/ui | [needs-install] | Question text field in form |
| `RadioGroup`, `RadioGroupItem` | @shadcn/ui | [needs-install] | "Correct answer" selector (one radio per option A-D) |
| `Skeleton` | @shadcn/ui | [needs-install] | Table row loading placeholders |
| `Separator` | @shadcn/ui | [needs-install] | Visual divide between filter panel and table |
| `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | @shadcn/ui | [needs-install] | Edit / Delete icon button accessible labels |
| `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` | @shadcn/ui | [needs-install] | Row actions menu (mobile-friendly collapse of edit+delete) |
| `ScrollArea` | @shadcn/ui | [needs-install] | Scrollable dialog content when form is tall |
| `Sonner` (toast) | @shadcn/ui | [needs-install] | Success / error feedback |

---

### Component Hierarchy

```
QuestionBankPage
├── TeacherPageShell (title="Question Bank", action=<AddQuestionDialogTrigger>)
│   └── main
│       ├── FilterPanel
│       │   └── Card > CardContent (flex gap-3 flex-wrap)
│       │       ├── Input (placeholder="Search questions…", controlled)
│       │       ├── Select → subject filter (populated from useExams + useExamSubjects)
│       │       └── Select → difficulty filter (easy | medium | hard | all)
│       ├── Separator
│       ├── [loading] TableSkeleton (5 rows × Skeleton)
│       ├── [empty] Alert + AlertDescription ("No questions match your filters")
│       └── [data] Table
│           ├── TableHeader
│           │   └── TableRow: Question | Subject | Difficulty | Options | Actions
│           └── TableBody
│               └── QuestionRow × N
│                   └── TableRow
│                       ├── TableCell: question text (truncate 80 chars)
│                       ├── TableCell: subject name
│                       ├── TableCell: Badge (difficulty, color-coded)
│                       ├── TableCell: "{N} options"
│                       └── TableCell: DropdownMenu (Edit | Delete)
│
├── QuestionFormDialog (mode: 'create' | 'edit', defaultValues?)
│   └── Dialog
│       └── DialogContent (max-w-2xl)
│           ├── DialogHeader + DialogTitle ("Add Question" | "Edit Question")
│           └── ScrollArea (max-h-[70vh])
│               └── Form
│                   ├── FormField → subject_id → Select (subjects across all exams)
│                   ├── FormField → difficulty → Select
│                   ├── FormField → text → Textarea (rows=4)
│                   ├── OptionsSection (4 fixed options A–D)
│                   │   └── [for each of A, B, C, D]
│                   │       ├── Label "Option {key}"
│                   │       ├── Input (option text)
│                   │       └── RadioGroupItem (correct answer — one group)
│                   ├── FormField → explanation → Textarea (optional, rows=2)
│                   ├── FormField → tags → Input (comma-separated, parsed to string[])
│                   └── DialogFooter
│                       ├── Button (variant=outline, "Cancel")
│                       └── Button (type=submit, "Save Question", loading state)
│
└── DeleteConfirmDialog
    └── AlertDialog
        └── AlertDialogContent
            ├── AlertDialogHeader
            │   ├── AlertDialogTitle ("Delete question?")
            │   └── AlertDialogDescription ("This action cannot be undone.")
            └── AlertDialogFooter
                ├── AlertDialogCancel ("Cancel")
                └── AlertDialogAction (variant=destructive, "Delete")
```

---

### State and Data Flow

**Server state (TanStack Query):**
- `useQuestions(filters)` — reactive on `filters` object: `{ subject_id?, difficulty?, page?, limit? }`; drives the table. `queryKey: questionKeys.list(filters)`.
- `useExams()` — populates subject filter dropdown (exam → subjects list).
- `useExamSubjects(examId)` — fetches subjects for a selected exam when populating the subject_id Select inside the form.
- `useCreateQuestion()` — mutation; on success: invalidate `questionKeys.all`, `toast.success('Question added')`.
- `useUpdateQuestion()` — mutation; on success: invalidate `questionKeys.all`, `toast.success('Question updated')`.
- `useDeleteQuestion()` — mutation; on success: invalidate `questionKeys.all`, `toast.success('Question deleted')`.

**Local state (useState):**
```ts
const [filters, setFilters] = useState<QuestionFilters>({})
const [searchInput, setSearchInput] = useState('')          // debounced → filters.search
const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
const [editTarget, setEditTarget] = useState<Question | null>(null)
const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)
```

**Form (react-hook-form + zod):**
```ts
const optionSchema = z.object({
  option_key: z.enum(['A', 'B', 'C', 'D']),
  text:       z.string().min(1, 'Option text required'),
})

const questionSchema = z.object({
  subject_id:  z.string().min(1, 'Subject required'),
  difficulty:  z.enum(['easy', 'medium', 'hard']),
  text:        z.string().min(10, 'At least 10 characters'),
  options:     z.array(optionSchema).length(4),
  correct_key: z.enum(['A', 'B', 'C', 'D']),   // local field; maps to options[i].is_correct before submit
  explanation: z.string().optional(),
  tags:        z.string().optional(),            // comma-separated; split to string[] on submit
})
```
On submit: transform `correct_key` → set `options[i].is_correct = (option.option_key === correct_key)`, then call mutation.

**Difficulty badge color mapping (Tailwind classes):**
```ts
const difficultyVariant = {
  easy:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100  text-amber-700',
  hard:   'bg-red-100    text-red-700',
}
```

---

### Accessibility Requirements

- Table uses semantic `<table>` via shadcn Table; `<th scope="col">` on all headers.
- `RadioGroup` for correct-answer selection uses `aria-label="Correct answer"`.
- Edit and Delete icon buttons carry `aria-label="Edit question"` / `aria-label="Delete question"`.
- `AlertDialog` for delete uses `aria-describedby` wired to `AlertDialogDescription`.
- Color-coded badges always include the text label (not color only).
- Filter inputs change are announced via `aria-live="polite"` region wrapping the result count.
- Search debounce: 300 ms to avoid thrashing queries and reduce screen-reader noise.

---

### Validation Rules

| Field | Rule |
|---|---|
| `subject_id` | required |
| `difficulty` | required, one of easy / medium / hard |
| `text` | required, min 10 chars, max 2000 chars |
| `options[*].text` | all 4 required, each min 1 char, max 500 chars |
| `correct_key` | required, must be one of A / B / C / D |
| `explanation` | optional, max 1000 chars |
| `tags` | optional, comma-separated; each tag max 30 chars; max 10 tags |

---

## T029 — Test Paper Creation Page

### Feature Name
TestPaperPage — 3-step wizard for composing a test paper: settings → question selection → per-question marks.

**Route:** `/teacher/test-papers`
**File:** `frontend/src/pages/teacher/TestPaperPage.tsx`

---

### Components Required

| Component | Source | Status | Purpose |
|---|---|---|---|
| `Button` | @shadcn/ui | [installed] | Next / Back / Submit step controls; row actions |
| `Input` | @shadcn/ui | [installed] | title, duration, total_marks, negative_marking_factor, marks/negative_marks per question |
| `Label` | @shadcn/ui | [installed] | All form field labels |
| `Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage` | @shadcn/ui | [installed] | Step 1 paper settings form |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | @shadcn/ui | [installed] | Exam picker (Step 1), subject filter (Step 2), difficulty filter (Step 2) |
| `Card`, `CardContent`, `CardHeader` | @shadcn/ui | [installed] | Wizard frame and step content container |
| `Alert`, `AlertDescription` | @shadcn/ui | [installed] | Validation error / empty state in question selector |
| `Badge` | @shadcn/ui | [needs-install] | Difficulty badge in question selector list; selected-count chip |
| `Checkbox` | @shadcn/ui | [needs-install] | Select/deselect questions in Step 2 |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | @shadcn/ui | [needs-install] | Step 2 question list; Step 3 marks assignment table |
| `Progress` | @shadcn/ui | [needs-install] | Visual step progress bar above wizard (33% / 66% / 100%) |
| `Switch` | @shadcn/ui | [needs-install] | shuffle_questions and shuffle_options toggles (Step 1) |
| `Separator` | @shadcn/ui | [needs-install] | Between step header and step body |
| `Skeleton` | @shadcn/ui | [needs-install] | Question list loading state in Step 2 |
| `ScrollArea` | @shadcn/ui | [needs-install] | Scrollable question list in Step 2 (fixed height panel) |
| `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | @shadcn/ui | [needs-install] | Field hints (e.g. "duration in minutes, stored as seconds") |
| `Sonner` (toast) | @shadcn/ui | [needs-install] | Success on paper created; error on API failure |

---

### Component Hierarchy

```
TestPaperPage
├── TeacherPageShell (title="Create Test Paper")
│   └── main (max-w-4xl mx-auto)
│       ├── StepIndicator
│       │   ├── Progress (value={stepPercent})
│       │   └── step labels row: "1. Settings" | "2. Questions" | "3. Marks & Confirm"
│       ├── Separator
│       └── Card (wizard frame)
│           ├── CardHeader: step title + description
│           └── CardContent
│               ├── [step === 1] PaperSettingsStep
│               │   └── Form (settingsSchema, react-hook-form)
│               │       ├── FormField → exam_id → Select (from useExams)
│               │       ├── FormField → title → Input
│               │       ├── FormField → duration → Input (type=number, min=1)
│               │       │   └── Tooltip: "Stored as seconds; enter minutes"
│               │       ├── FormField → total_marks → Input (type=number)
│               │       ├── FormField → negative_marking_factor → Input (type=number, step=0.25, min=0)
│               │       │   └── Tooltip: "e.g. 0.25 means ¼ mark deducted per wrong answer"
│               │       ├── FormField → shuffle_questions → Switch + Label
│               │       ├── FormField → shuffle_options → Switch + Label
│               │       └── StepNavFooter
│               │           └── Button ("Next: Select Questions →")
│               │
│               ├── [step === 2] QuestionSelectorStep
│               │   ├── FilterBar (flex gap-2)
│               │   │   ├── Input (search, debounced 300ms)
│               │   │   ├── Select → subject filter
│               │   │   └── Select → difficulty filter
│               │   ├── SelectedBadge: Badge ("N selected")
│               │   ├── [loading] Skeleton rows
│               │   ├── [empty] Alert
│               │   └── ScrollArea (h-[480px])
│               │       └── Table
│               │           ├── TableHeader: [ ] | Question | Subject | Difficulty
│               │           └── TableBody
│               │               └── QuestionSelectRow × N
│               │                   └── TableRow
│               │                       ├── TableCell: Checkbox (controlled)
│               │                       ├── TableCell: question text (truncate)
│               │                       ├── TableCell: subject name
│               │                       └── TableCell: Badge (difficulty)
│               │   └── StepNavFooter
│               │       ├── Button (variant=outline, "← Back")
│               │       └── Button ("Next: Set Marks →", disabled if selectedIds.size === 0)
│               │
│               └── [step === 3] MarksStep
│                   ├── Table
│                   │   ├── TableHeader: # | Question | Marks | Negative Marks | Order
│                   │   └── TableBody
│                   │       └── MarksRow × N (one per selectedQuestion)
│                   │           └── TableRow
│                   │               ├── TableCell: display order (auto-incremented, editable Input type=number)
│                   │               ├── TableCell: question text (truncate)
│                   │               ├── TableCell: Input (marks, type=number, min=0)
│                   │               └── TableCell: Input (negative_marks, type=number, min=0)
│                   └── StepNavFooter
│                       ├── Button (variant=outline, "← Back")
│                       └── Button (variant=default, "Create Test Paper", loading state)
```

---

### State and Data Flow

**Server state (TanStack Query):**
- `useExams()` — Step 1 exam_id Select population.
- `useQuestions(filters)` — Step 2 question list; reactive to `{ subject_id?, difficulty?, search? }`.
- `useCreateTestPaper()` — Step 3 submit: `mutateAsync({ examId, data: TestPaperCreatePayload })`.
- `useAddQuestionsToPaper()` — Step 3 submit (sequential after paper created): `mutateAsync({ paperId, items: TestPaperQuestionAddItem[] })`.

**Local state (useState / Zustand not required — page-local is sufficient):**
```ts
const [step, setStep]                   = useState<1 | 2 | 3>(1)
const [settingsData, setSettingsData]   = useState<PaperSettingsFormValues | null>(null)
const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
const [marksRows, setMarksRows]         = useState<MarksRowState[]>([])
const [q2Filters, setQ2Filters]         = useState<QuestionFilters>({})
const [submitting, setSubmitting]       = useState(false)
```

**`MarksRowState` shape:**
```ts
interface MarksRowState {
  question_id:    string
  question_text:  string
  marks:          number   // default: 4
  negative_marks: number   // default: 1
  display_order:  number   // initialized 1…N; user-editable
}
```

**Step transition logic:**
1. Step 1 → 2: `handleSubmit` on settings form validates all fields; stores `settingsData`; calls `setStep(2)`.
2. Step 2 → 3: requires `selectedIds.size >= 1`; initializes `marksRows` from `selectedIds`; calls `setStep(3)`.
3. Step 3 → submit: calls `createTestPaper.mutateAsync` with `settingsData` (converting `duration` minutes → `duration_seconds = duration * 60`); on success calls `addQuestionsToPaper.mutateAsync` with `marksRows`; on full success calls `toast.success` and `navigate('/teacher/exams')`.

**Form (react-hook-form + zod) — Step 1 only (Steps 2–3 use controlled state):**
```ts
const settingsSchema = z.object({
  exam_id:                  z.string().min(1, 'Select an exam'),
  title:                    z.string().min(3).max(200),
  duration:                 z.coerce.number().int().min(1, 'Minimum 1 minute').max(360),
  total_marks:              z.coerce.number().min(1),
  negative_marking_factor:  z.coerce.number().min(0).max(4).default(0.25),
  shuffle_questions:        z.boolean().default(false),
  shuffle_options:          z.boolean().default(false),
})
```

---

### Accessibility Requirements

- `Progress` bar includes `aria-label="Step {step} of 3"` and `aria-valuenow={step}`.
- Step indicator text labels carry `aria-current="step"` on the active step.
- Checkbox column in Step 2 table: `TableHead` contains a "select all" Checkbox with `aria-label="Select all questions"`.
- Each row Checkbox: `aria-label="Select question: {truncated text}"`.
- Switch components: associated `Label` is linked via `htmlFor`; additionally include `aria-describedby` pointing to a helper text node.
- Input fields for marks in Step 3: `aria-label="Marks for question {n}"` / `aria-label="Negative marks for question {n}"`.
- Navigation buttons carry descriptive text (not icon-only); Back button is never icon-only.
- Loading state during final submit: Button becomes `disabled` and shows spinner; `aria-busy="true"` on the submit Button.

---

### Validation Rules

**Step 1 (settings form):**

| Field | Rule |
|---|---|
| `exam_id` | required |
| `title` | required, min 3 chars, max 200 chars |
| `duration` | required integer, min 1 min, max 360 min |
| `total_marks` | required, min 1 |
| `negative_marking_factor` | number, min 0, max 4, step 0.25; default 0.25 |
| `shuffle_questions` | boolean, default false |
| `shuffle_options` | boolean, default false |

**Step 2 (question selection):**
- Must select at least 1 question before advancing (button disabled otherwise).

**Step 3 (marks):**
- `marks` per question: number, min 0, required.
- `negative_marks` per question: number, min 0, required.
- `display_order`: positive integer, must be unique across all rows (warn if duplicates, do not block submit).

---

## Consolidated "Components to Install"

All of the following are confirmed present in the `@shadcn` registry. None are currently installed (absent from `frontend/src/components/ui/`). Install in a single command or individually.

**Single-command install:**
```bash
npx shadcn@latest add dialog alert-dialog badge table textarea radio-group checkbox skeleton separator tooltip dropdown-menu scroll-area switch progress sonner
```

**Itemised list with rationale:**

| Component | Used by | Rationale |
|---|---|---|
| `dialog` | T027, T028 | Create Exam modal; Add/Edit Question modal |
| `alert-dialog` | T028 | Destructive delete confirmation |
| `badge` | T027, T028, T029 | Published/draft status; difficulty color pills; subject chips; selected count |
| `table` | T028, T029 | Question list (T028); question selector + marks table (T029) |
| `textarea` | T028 | Question text field; explanation field |
| `radio-group` | T028 | Correct-answer selection (A/B/C/D) |
| `checkbox` | T029 | Question selection checkboxes in Step 2 |
| `skeleton` | T027, T028, T029 | Card/table/row loading placeholders |
| `separator` | T027, T028, T029 | Visual dividers throughout |
| `tooltip` | T027, T028, T029 | Icon button labels; field hints |
| `dropdown-menu` | T028 | Row actions menu (Edit / Delete) |
| `scroll-area` | T028, T029 | Tall dialog form body; Step 2 question list |
| `switch` | T029 | shuffle_questions / shuffle_options toggles |
| `progress` | T029 | 3-step wizard progress bar |
| `sonner` | T027, T028, T029 | Toast notifications (success / error) across all pages |

**Already installed — no action needed:**
`button`, `input`, `label`, `card`, `form`, `select`, `alert`

---

## Shared Component Worth Extracting

### `TeacherPageShell` (`frontend/src/components/teacher/TeacherPageShell.tsx`)

**Justification:** All three pages share an identical header pattern — sticky top bar, page title + description, right-aligned action slot. Extracting it prevents copy-paste drift and ensures consistent spacing, backdrop blur, and border treatment across T027/T028/T029 and any future teacher pages.

**Other candidates for extraction:**
- `DifficultyBadge` — a micro-component that maps `Difficulty` → colored `Badge`. Used identically in T028 and T029's question lists.
- `FilterBar` — a horizontal flex container with Input + Select(s) that appears in both T028 and T029 Step 2. Worth extracting once both pages are implemented.
- `StepNavFooter` — the Back / Next button row at the bottom of each wizard step in T029 (page-local extraction; not shared with T027/T028).
