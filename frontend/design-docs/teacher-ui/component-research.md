# Teacher UI — shadcn/ui Component Research

**Scope:** T027 (Exam Management), T028 (Question Bank), T029 (Test Paper Creation)
**Stack context:** React 18 + Vite 5 + TypeScript strict. No RSC, no `"use client"`, no `next/*`.
**Forms:** react-hook-form + Zod. **Server state:** TanStack Query v5.

---

## Installation Command

Run once from the `frontend/` directory before implementing any of the three pages:

```bash
npx shadcn@latest add @shadcn/dialog @shadcn/alert-dialog @shadcn/badge @shadcn/table @shadcn/textarea @shadcn/radio-group @shadcn/checkbox @shadcn/skeleton @shadcn/separator @shadcn/tooltip @shadcn/dropdown-menu @shadcn/scroll-area @shadcn/switch @shadcn/progress @shadcn/sonner
```

All 15 components resolve cleanly from the `@shadcn` registry. Radix UI primitives are the underlying dependency for all except `table`, `skeleton`, and `textarea` (those are pure Tailwind wrappers with no Radix dep). `sonner` additionally pulls in the `sonner` npm package and `next-themes` — the `next-themes` dep is only used by the `<Toaster>` theme prop; it works in Vite/non-Next environments without any config change.

**Already installed — no action needed:**
`button`, `input`, `label`, `card`, `form`, `select`, `alert`

---

## Focus Area 1 — Sonner (Toast System)

### How it works

`sonner` exposes two things: a `<Toaster />` React component that renders the toast container, and a `toast` imperative API that can be called from anywhere.

### Mount Toaster once at app root

In a Vite SPA the right place is `frontend/src/main.tsx` or the top-level `App.tsx` — wherever the router is rendered. It must live outside any page component so it persists across route changes.

```tsx
// frontend/src/App.tsx  (or main.tsx, whichever is the root render point)
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      {/* Single Toaster for the entire app — place after the router */}
      <Toaster position="top-right" richColors />
    </>
  )
}
```

Key `<Toaster>` props:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left' \| 'top-center' \| 'bottom-center'` | `'bottom-right'` | `'top-right'` matches most admin tool conventions |
| `richColors` | `boolean` | `false` | Enables semantic green/red coloring for success/error |
| `expand` | `boolean` | `false` | When true toasts stack expanded instead of stacked |
| `duration` | `number` | `4000` | Default ms before auto-dismiss |
| `closeButton` | `boolean` | `false` | Renders an explicit close button on each toast |

### toast() API

```tsx
import { toast } from 'sonner'

// Success — used after create/update mutations
toast.success('Exam created', {
  description: 'Your new exam is ready to receive subjects.',
})

// Error — used in mutation onError callbacks
toast.error('Failed to create exam', {
  description: error.message ?? 'An unexpected error occurred.',
})

// Bare toast (neutral)
toast('Event has been created')

// With action (e.g., undo)
toast.success('Question deleted', {
  action: { label: 'Undo', onClick: () => undoDelete() },
})
```

### Integration with TanStack Query mutations

```tsx
const createExam = useMutation({
  mutationFn: examApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: examKeys.all })
    toast.success('Exam created')
    setDialogOpen(false)
    form.reset()
  },
  onError: (err: ApiError) => {
    toast.error('Failed to create exam', { description: err.message })
  },
})
```

No context provider is required. `toast()` is a plain function call — it works from mutation callbacks, event handlers, or anywhere in the component tree.

---

## Focus Area 2 — Dialog vs AlertDialog

### When to use which

| Scenario | Component |
|---|---|
| Create Exam modal (T027) | `Dialog` |
| Add / Edit Question modal (T028) | `Dialog` |
| Delete question confirmation (T028) | `AlertDialog` |

**Rule:** Use `AlertDialog` exclusively for destructive, irreversible actions. It enforces an accessible pattern where the user must consciously choose "Continue" vs "Cancel", and Radix prevents closing it by clicking the backdrop (unlike `Dialog`). Use `Dialog` for all regular content/form modals.

### Dialog — controlled open state with react-hook-form

The key pattern: control `open` via parent `useState`, reset the form `onOpenChange` so stale values never re-appear when the dialog is reopened, and put `<form>` inside `<DialogContent>` (not wrapping `<Dialog>` itself — the demo wraps Dialog in form, but the controlled pattern below is cleaner with RHF).

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormField, FormItem, FormLabel,
  FormControl, FormMessage,
} from '@/components/ui/form'

interface CreateExamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateExamDialog({ open, onOpenChange }: CreateExamDialogProps) {
  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: { title: '', exam_type: '', description: '' },
  })

  // CRITICAL: reset form whenever dialog closes (open transitions false→true AND true→false)
  // Use useEffect keyed on `open` so reset fires on both open and close
  React.useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  const createExam = useMutation({ /* ... */ })

  function onSubmit(data: ExamFormValues) {
    createExam.mutate(data, {
      onSuccess: () => onOpenChange(false),  // close triggers useEffect → form.reset()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Exam</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="JEE Main 2025 Mock #1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* ... other fields ... */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createExam.isPending}>
                {createExam.isPending ? 'Creating…' : 'Create Exam'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

**Accessibility notes:**
- `DialogTitle` is mandatory — Radix wires `aria-labelledby` from `DialogContent` to `DialogTitle` automatically.
- `DialogDescription` is optional but recommended; adds `aria-describedby`.
- Focus is trapped inside the dialog by Radix. First focusable element receives focus on open.
- Pressing Escape calls `onOpenChange(false)` automatically.

### AlertDialog — destructive delete confirmation

`AlertDialogAction` renders as a regular `<button>`. Apply destructive styling with `className`:

```tsx
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

interface DeleteQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionText: string
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteQuestionDialog({
  open, onOpenChange, questionText, onConfirm, isDeleting,
}: DeleteQuestionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete question?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The question
            "{questionText.slice(0, 60)}…" will be permanently removed
            from the question bank.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Key difference from Dialog:** `AlertDialog` cannot be dismissed by clicking the backdrop. The user must explicitly click Cancel or the action button. Radix enforces this by not responding to outside clicks.

---

## Focus Area 3 — RadioGroup wired via react-hook-form FormField

This is the correct-answer selector (A/B/C/D) in T028's QuestionFormDialog. The wiring is identical to how `Select` works inside `FormField`: the `render` prop receives `field`, and you spread `value` + `onValueChange` onto `RadioGroup`.

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'

// Inside QuestionFormDialog, after the 4 option inputs:
<FormField
  control={form.control}
  name="correct_key"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Correct Answer</FormLabel>
      <FormControl>
        <RadioGroup
          value={field.value}
          onValueChange={field.onChange}
          aria-label="Correct answer"
          className="flex gap-6"
        >
          {(['A', 'B', 'C', 'D'] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <RadioGroupItem value={key} id={`correct-${key}`} />
              <Label htmlFor={`correct-${key}`}>Option {key}</Label>
            </div>
          ))}
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Key props:**

| Prop | On | Notes |
|---|---|---|
| `value` | `RadioGroup` | Controlled value — pass `field.value` from RHF |
| `onValueChange` | `RadioGroup` | Passes the selected string — pass `field.onChange` |
| `value` | `RadioGroupItem` | The string this item represents (e.g. `'A'`) |
| `id` | `RadioGroupItem` | Must match `htmlFor` on the Label for keyboard/SR |
| `aria-label` | `RadioGroup` | Required when there is no visible group label element |

**Do not** use `defaultValue` on a controlled `RadioGroup` — use the `useForm` `defaultValues` to set the initial `correct_key`.

---

## Focus Area 4 — Checkbox for controlled Set selection (T029 Step 2)

The question selector in T029 Step 2 manages a `Set<string>` of selected question IDs. Each row checkbox is independent (not RHF-controlled — this step uses plain `useState`).

```tsx
// In TestPaperPage:
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

function toggleQuestion(id: string) {
  setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}

function toggleAll(questions: Question[]) {
  setSelectedIds(prev =>
    prev.size === questions.length
      ? new Set()
      : new Set(questions.map(q => q.id))
  )
}
```

```tsx
// TableHead "select all" checkbox:
<TableHead className="w-10">
  <Checkbox
    checked={
      questions.length > 0 && selectedIds.size === questions.length
        ? true
        : selectedIds.size > 0
        ? 'indeterminate'   // Checkbox accepts boolean | 'indeterminate'
        : false
    }
    onCheckedChange={() => toggleAll(questions)}
    aria-label="Select all questions"
  />
</TableHead>

// Per-row checkbox inside TableCell:
<TableCell className="w-10">
  <Checkbox
    checked={selectedIds.has(question.id)}
    onCheckedChange={() => toggleQuestion(question.id)}
    aria-label={`Select question: ${question.text.slice(0, 50)}`}
  />
</TableCell>
```

**Key props:**

| Prop | Type | Notes |
|---|---|---|
| `checked` | `boolean \| 'indeterminate'` | `'indeterminate'` renders the dash state for partial selection |
| `onCheckedChange` | `(checked: boolean \| 'indeterminate') => void` | Called with the new state; ignore the argument value and derive from your Set |
| `disabled` | `boolean` | Greys out and prevents interaction |

**Note:** `Checkbox` is a Radix `CheckboxPrimitive.Root` — it renders a `<button role="checkbox">`, not an `<input type="checkbox">`. The `aria-label` on the element is therefore the correct accessibility approach.

---

## Focus Area 5 — Table composition

shadcn `table` is a set of thin `<div>`-free semantic wrappers over real HTML table elements. No external library (TanStack Table) is required for the static tables in T028 and T029.

### Exports

```
Table          → <table>
TableHeader    → <thead>
TableBody      → <tbody>
TableFooter    → <tfoot>
TableRow       → <tr>
TableHead      → <th scope="col">  ← shadcn adds scope="col" automatically
TableCell      → <td>
TableCaption   → <caption>
```

### Question bank table (T028)

```tsx
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell,
} from '@/components/ui/table'

<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-[50%]">Question</TableHead>
        <TableHead>Subject</TableHead>
        <TableHead>Difficulty</TableHead>
        <TableHead className="w-[80px]">Options</TableHead>
        <TableHead className="w-[60px] text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {questions.length === 0 ? (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
            No questions match your filters.
          </TableCell>
        </TableRow>
      ) : (
        questions.map((q) => (
          <TableRow key={q.id}>
            <TableCell className="max-w-[300px] truncate font-medium">
              {q.text}
            </TableCell>
            <TableCell>{q.subject_name}</TableCell>
            <TableCell>
              <DifficultyBadge difficulty={q.difficulty} />
            </TableCell>
            <TableCell>{q.options.length} options</TableCell>
            <TableCell className="text-right">
              <QuestionRowActions question={q} />
            </TableCell>
          </TableRow>
        ))
      )}
    </TableBody>
  </Table>
</div>
```

### Marks assignment table (T029 Step 3) — inputs inside cells

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[40px]">#</TableHead>
      <TableHead>Question</TableHead>
      <TableHead className="w-[100px]">Marks</TableHead>
      <TableHead className="w-[120px]">Negative Marks</TableHead>
      <TableHead className="w-[80px]">Order</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {marksRows.map((row, index) => (
      <TableRow key={row.question_id}>
        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
        <TableCell className="max-w-[300px] truncate">{row.question_text}</TableCell>
        <TableCell>
          <Input
            type="number"
            min={0}
            value={row.marks}
            onChange={(e) => updateMarksRow(index, 'marks', Number(e.target.value))}
            className="w-20"
            aria-label={`Marks for question ${index + 1}`}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min={0}
            value={row.negative_marks}
            onChange={(e) => updateMarksRow(index, 'negative_marks', Number(e.target.value))}
            className="w-20"
            aria-label={`Negative marks for question ${index + 1}`}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min={1}
            value={row.display_order}
            onChange={(e) => updateMarksRow(index, 'display_order', Number(e.target.value))}
            className="w-16"
          />
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## Focus Area 6 — Progress as Step Indicator (T029)

`Progress` wraps Radix `ProgressPrimitive.Root` and renders a single bar. For a 3-step wizard, map step to a percentage value.

```tsx
import { Progress } from '@/components/ui/progress'

const stepPercent: Record<1 | 2 | 3, number> = { 1: 33, 2: 66, 3: 100 }

// In StepIndicator component:
<div className="space-y-2">
  <Progress
    value={stepPercent[step]}
    className="h-2"
    aria-label={`Step ${step} of 3`}
    aria-valuenow={step}
    aria-valuemin={1}
    aria-valuemax={3}
  />
  <div className="flex justify-between text-xs text-muted-foreground">
    {(['1. Settings', '2. Questions', '3. Marks & Confirm'] as const).map(
      (label, i) => (
        <span
          key={label}
          aria-current={step === i + 1 ? 'step' : undefined}
          className={step === i + 1 ? 'font-medium text-foreground' : ''}
        >
          {label}
        </span>
      )
    )}
  </div>
</div>
```

**Key props:**

| Prop | Type | Notes |
|---|---|---|
| `value` | `number \| null` | 0–100. `null` renders indeterminate animation |
| `max` | `number` | Default `100`; keep at 100 and map steps to percent |
| `className` | `string` | Use `h-2` for thin bar, `h-3` for slightly thicker |

Radix automatically sets `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={100}`, and `aria-valuenow={value}` on the root element. The additional `aria-label` override above replaces the default numeric read-out with a more meaningful "Step 2 of 3".

---

## Focus Area 7 — Switch wired via react-hook-form FormField

`Switch` is a Radix `SwitchPrimitive.Root` that behaves like a checkbox. In react-hook-form the wiring uses `checked` / `onCheckedChange` (not `value` / `onChange`) because Switch is a boolean control.

```tsx
import { Switch } from '@/components/ui/switch'
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form'

// Inside PaperSettingsStep Form — one block per toggle:
<FormField
  control={form.control}
  name="shuffle_questions"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
      <div className="space-y-0.5">
        <FormLabel>Shuffle Questions</FormLabel>
        <FormDescription>
          Randomise question order for each student.
        </FormDescription>
      </div>
      <FormControl>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
          aria-describedby="shuffle-questions-description"
        />
      </FormControl>
    </FormItem>
  )}
/>

<FormField
  control={form.control}
  name="shuffle_options"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
      <div className="space-y-0.5">
        <FormLabel>Shuffle Options</FormLabel>
        <FormDescription>
          Randomise A/B/C/D option order for each student.
        </FormDescription>
      </div>
      <FormControl>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

**Critical wiring note:** Do NOT use `value`/`onChange` here. Switch is boolean; RHF will receive `true`/`false` from `onCheckedChange`. Using `onChange` would receive a React synthetic event instead.

**Zod schema entry for booleans:**
```ts
shuffle_questions: z.boolean().default(false),
shuffle_options:   z.boolean().default(false),
```

**Key props:**

| Prop | Type | Notes |
|---|---|---|
| `checked` | `boolean` | Controlled value |
| `onCheckedChange` | `(checked: boolean) => void` | Receives a plain boolean, not an event |
| `disabled` | `boolean` | Greys out |
| `id` | `string` | Link to `Label` via `htmlFor` when not using `FormLabel` |

---

## Remaining Components — API Quick Reference

### Badge

```tsx
import { Badge } from '@/components/ui/badge'

// Variants: 'default' | 'secondary' | 'destructive' | 'outline'
<Badge>Published</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="outline">JEE</Badge>

// Difficulty badges — use className override (variants don't cover semantic colors):
const difficultyClass = {
  easy:   'bg-emerald-100 text-emerald-700 border-transparent',
  medium: 'bg-amber-100 text-amber-700 border-transparent',
  hard:   'bg-red-100 text-red-700 border-transparent',
}

// Micro-component worth extracting:
function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  return (
    <Badge className={difficultyClass[difficulty]} variant="outline">
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </Badge>
  )
}
```

### Skeleton

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Card loading placeholder for T027:
function ExamCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

// Table row loading placeholder for T028/T029:
function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <TableRow aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-full" /></TableCell>
      ))}
    </TableRow>
  )
}

// Apply aria-busy on the wrapping grid/table during load:
<div className="grid grid-cols-3 gap-4" aria-busy={isLoading}>
  {isLoading
    ? Array.from({ length: 3 }).map((_, i) => <ExamCardSkeleton key={i} />)
    : exams.map(e => <ExamCard key={e.id} exam={e} />)
  }
</div>
```

### Separator

```tsx
import { Separator } from '@/components/ui/separator'

// Horizontal (default) — visual divider:
<Separator className="my-4" />

// Vertical — inside a flex row:
<Separator orientation="vertical" className="h-6 mx-2" />
```

Props: `orientation` (`'horizontal'` | `'vertical'`), `decorative` (boolean, default `true` — sets `role="none"` so screen readers skip it; set `false` if the separator conveys structure).

### Textarea

```tsx
import { Textarea } from '@/components/ui/textarea'

// Inside FormField:
<FormField
  control={form.control}
  name="text"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Question Text</FormLabel>
      <FormControl>
        <Textarea
          placeholder="Enter the question…"
          rows={4}
          className="resize-none"
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

`Textarea` is a plain styled `<textarea>` — spread `{...field}` directly, same as `Input`. Use `resize-none` to prevent manual resizing inside a `ScrollArea`.

### Tooltip

```tsx
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'

// TooltipProvider must wrap the tree — mount once high up (e.g. App.tsx):
// <TooltipProvider delayDuration={300}> ... </TooltipProvider>

// Usage at point of use:
<Tooltip>
  <TooltipTrigger asChild>
    <Button size="icon" variant="ghost" aria-label="Add subject to Physics">
      <PlusIcon className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Add subject</p>
  </TooltipContent>
</Tooltip>
```

**Important:** `TooltipProvider` must be an ancestor — mount it once at app root (alongside `<Toaster />`), not per-usage. `delayDuration={300}` is a good default. The `aria-label` on the trigger is the accessibility fallback for keyboard/screen-reader users who will never see the tooltip.

### DropdownMenu (row actions)

```tsx
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

function QuestionRowActions({ question, onEdit, onDelete }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
          <span className="sr-only">Open actions for question</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(question)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(question)}
          className="text-destructive focus:text-destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### ScrollArea

```tsx
import { ScrollArea } from '@/components/ui/scroll-area'

// Tall dialog form (T028 QuestionFormDialog):
<ScrollArea className="max-h-[70vh] pr-4">
  {/* form contents */}
</ScrollArea>

// Scrollable question list panel (T029 Step 2):
<ScrollArea className="h-[480px] rounded-md border">
  <Table> ... </Table>
</ScrollArea>
```

The `pr-4` on the dialog variant leaves room for the scrollbar so it does not overlap content. `ScrollArea` renders a custom scrollbar using Radix — it is hidden by default and appears on hover/scroll.

---

## App Root Setup Summary

Mount these providers/singletons once in `frontend/src/App.tsx` (or equivalent root):

```tsx
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  )
}
```

`TooltipProvider` wraps the router so every page can use `<Tooltip>` without repeating the provider. `<Toaster>` goes after the router (outside the layout tree) so it renders above all page content in the stacking context.

---

## Integration Notes

### react-hook-form controlled vs uncontrolled recap

| Component | RHF prop pair | Notes |
|---|---|---|
| `Input`, `Textarea` | `{...field}` spread | `field` carries value + onChange + onBlur + ref |
| `Select` | `value={field.value}` + `onValueChange={field.onChange}` | Cannot spread — Radix Select is not a native input |
| `RadioGroup` | `value={field.value}` + `onValueChange={field.onChange}` | Same as Select |
| `Switch` | `checked={field.value}` + `onCheckedChange={field.onChange}` | Boolean; do not use `value`/`onChange` |
| `Checkbox` (RHF) | `checked={field.value}` + `onCheckedChange={field.onChange}` | Boolean; only use when inside FormField |
| `Checkbox` (Set state) | `checked={set.has(id)}` + `onCheckedChange={() => toggle(id)}` | Plain state, no FormField needed |

### Vite path alias

All imports above use `@/components/ui/...`. Confirm `tsconfig.json` and `vite.config.ts` both have:
```ts
// vite.config.ts
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```

### No "use client" needed

None of these components require `"use client"` — that directive is Next.js App Router only. All Radix primitives work as-is in a client-only Vite SPA.

### sonner + next-themes in Vite

The `next-themes` package installed as a transitive dep of `sonner` does not require any Next.js setup. The `<Toaster>` component accepts a `theme` prop (`'light' | 'dark' | 'system'`) directly — you do not need to install or configure `next-themes` yourself. Pass `theme="system"` if the app has a dark mode toggle; omit it otherwise.
