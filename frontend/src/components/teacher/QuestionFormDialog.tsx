import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import { useExams, useExamSubjects } from '@/hooks/useExams'
import { useCreateQuestion, useUpdateQuestion } from '@/hooks/useQuestions'
import type { Question, Difficulty, OptionKey } from '@/types/question'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const optionKeys = ['A', 'B', 'C', 'D'] as const

const createSchema = z.object({
  exam_id: z.string().min(1, 'Select an exam'),
  subject_id: z.string().min(1, 'Subject required'),
  difficulty: z.enum(['easy', 'medium', 'hard'] as const, {
    required_error: 'Difficulty required',
  }),
  text: z
    .string()
    .min(10, 'At least 10 characters')
    .max(2000, 'Maximum 2000 characters'),
  option_a: z.string().min(1, 'Option A required').max(500, 'Maximum 500 characters'),
  option_b: z.string().min(1, 'Option B required').max(500, 'Maximum 500 characters'),
  option_c: z.string().min(1, 'Option C required').max(500, 'Maximum 500 characters'),
  option_d: z.string().min(1, 'Option D required').max(500, 'Maximum 500 characters'),
  correct_key: z.enum(['A', 'B', 'C', 'D'] as const, {
    required_error: 'Select the correct answer',
  }),
  explanation: z.string().max(1000, 'Maximum 1000 characters').optional(),
  tags: z.string().optional(),
})

const editSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard'] as const, {
    required_error: 'Difficulty required',
  }),
  text: z
    .string()
    .min(10, 'At least 10 characters')
    .max(2000, 'Maximum 2000 characters'),
  explanation: z.string().max(1000, 'Maximum 1000 characters').optional(),
  tags: z.string().optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CreateProps extends BaseProps {
  mode: 'create'
  question?: undefined
}

interface EditProps extends BaseProps {
  mode: 'edit'
  question: Question
}

export type QuestionFormDialogProps = CreateProps | EditProps

// ---------------------------------------------------------------------------
// Shared ExamSubjectSelectors — used inside create form
// ---------------------------------------------------------------------------

interface ExamSubjectSelectorsProps {
  examId: string
  onExamChange: (id: string) => void
  examError?: string
  subjectId: string
  onSubjectChange: (id: string) => void
  subjectError?: string
}

function ExamSubjectSelectors({
  examId,
  onExamChange,
  examError,
  subjectId,
  onSubjectChange,
  subjectError,
}: ExamSubjectSelectorsProps) {
  const { data: examsData, isLoading: examsLoading } = useExams()
  const exams = examsData?.items ?? []

  const { data: subjectsData, isLoading: subjectsLoading } = useExamSubjects(
    examId || undefined,
  )
  const subjects = subjectsData ?? []

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Exam picker */}
      <div className="space-y-2">
        <Label htmlFor="exam-select">
          Exam <span className="text-destructive">*</span>
        </Label>
        <Select
          value={examId}
          onValueChange={onExamChange}
          disabled={examsLoading}
        >
          <SelectTrigger id="exam-select" aria-label="Select exam">
            <SelectValue placeholder={examsLoading ? 'Loading…' : 'Pick an exam'} />
          </SelectTrigger>
          <SelectContent>
            {exams.map((exam) => (
              <SelectItem key={exam.id} value={exam.id}>
                {exam.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {examError && (
          <p className="text-sm font-medium text-destructive">{examError}</p>
        )}
      </div>

      {/* Subject picker */}
      <div className="space-y-2">
        <Label htmlFor="subject-select">
          Subject <span className="text-destructive">*</span>
        </Label>
        <Select
          value={subjectId}
          onValueChange={onSubjectChange}
          disabled={!examId || subjectsLoading}
        >
          <SelectTrigger id="subject-select" aria-label="Select subject">
            <SelectValue
              placeholder={
                !examId
                  ? 'Pick an exam first'
                  : subjectsLoading
                  ? 'Loading…'
                  : 'Pick a subject'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subjectError && (
          <p className="text-sm font-medium text-destructive">{subjectError}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

function CreateQuestionForm({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  const createQuestion = useCreateQuestion()

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      exam_id: '',
      subject_id: '',
      difficulty: undefined,
      text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_key: undefined,
      explanation: '',
      tags: '',
    },
  })

  // When exam changes, clear subject selection
  const selectedExamId = form.watch('exam_id')
  useEffect(() => {
    form.setValue('subject_id', '')
  }, [selectedExamId, form])

  async function onSubmit(values: CreateFormValues) {
    const optionTextMap: Record<OptionKey, string> = {
      A: values.option_a,
      B: values.option_b,
      C: values.option_c,
      D: values.option_d,
    }

    const options = optionKeys.map((key) => ({
      option_key: key as OptionKey,
      text: optionTextMap[key],
      is_correct: key === values.correct_key,
    }))

    const tagsArray = values.tags
      ? values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
      : []

    try {
      await createQuestion.mutateAsync({
        subject_id: values.subject_id,
        text: values.text,
        difficulty: values.difficulty as Difficulty,
        options,
        explanation: values.explanation || undefined,
        tags: tagsArray,
      })
      toast.success('Question added', {
        description: 'The question has been saved to the bank.',
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error('Failed to add question', { description: message })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <ScrollArea className="max-h-[62vh] pr-4">
          <div className="space-y-5 pb-1">
            {/* Exam + Subject */}
            <ExamSubjectSelectors
              examId={form.watch('exam_id')}
              onExamChange={(id) => form.setValue('exam_id', id, { shouldValidate: true })}
              examError={form.formState.errors.exam_id?.message}
              subjectId={form.watch('subject_id')}
              onSubjectChange={(id) =>
                form.setValue('subject_id', id, { shouldValidate: true })
              }
              subjectError={form.formState.errors.subject_id?.message}
            />

            {/* Difficulty */}
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Difficulty <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Select difficulty">
                        <SelectValue placeholder="Pick difficulty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Question text */}
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Question Text <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the full question text…"
                      rows={4}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Options + correct answer */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Options <span className="text-destructive">*</span>
                </p>
                <FormField
                  control={form.control}
                  name="correct_key"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          aria-label="Correct answer"
                          className="flex gap-1"
                        >
                          {optionKeys.map((key) => (
                            <div key={key} className="flex items-center">
                              {/* hidden: actual selection handled below per-row */}
                              <RadioGroupItem
                                value={key}
                                id={`correct-header-${key}`}
                                className="sr-only"
                              />
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Per-option rows */}
              <FormField
                control={form.control}
                name="correct_key"
                render={({ field: correctField }) => (
                  <div className="space-y-2">
                    {(
                      [
                        { key: 'A', fieldName: 'option_a' },
                        { key: 'B', fieldName: 'option_b' },
                        { key: 'C', fieldName: 'option_c' },
                        { key: 'D', fieldName: 'option_d' },
                      ] as { key: OptionKey; fieldName: keyof CreateFormValues }[]
                    ).map(({ key, fieldName }) => (
                      <div key={key} className="flex items-center gap-3">
                        {/* Correct answer radio */}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={correctField.value === key}
                          aria-label={`Mark option ${key} as correct`}
                          onClick={() =>
                            correctField.onChange(key)
                          }
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            correctField.value === key
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40 hover:border-primary/60'
                          }`}
                        >
                          {correctField.value === key && (
                            <span className="text-xs font-bold">{key}</span>
                          )}
                        </button>

                        {/* Key label */}
                        <span className="w-6 shrink-0 text-sm font-medium text-muted-foreground">
                          {key}
                        </span>

                        {/* Option text input */}
                        <FormField
                          control={form.control}
                          name={fieldName}
                          render={({ field }) => (
                            <FormItem className="flex-1 space-y-0">
                              <FormControl>
                                <Input
                                  placeholder={`Option ${key}`}
                                  aria-label={`Option ${key} text`}
                                  {...field}
                                  value={field.value as string}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                    {/* Show correct_key error below options */}
                    {form.formState.errors.correct_key && (
                      <p className="text-sm font-medium text-destructive">
                        {form.formState.errors.correct_key.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Click the circle next to an option to mark it as the correct answer.
                    </p>
                  </div>
                )}
              />
            </div>

            <Separator />

            {/* Explanation (optional) */}
            <FormField
              control={form.control}
              name="explanation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief explanation of the correct answer…"
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags (optional) */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="kinematics, newton, velocity (comma-separated)"
                      aria-label="Tags, comma-separated"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Up to 10 tags, 30 characters each.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createQuestion.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createQuestion.isPending}>
            {createQuestion.isPending ? 'Saving…' : 'Save Question'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// ---------------------------------------------------------------------------
// Edit form — text / difficulty / explanation / tags only (no options)
// ---------------------------------------------------------------------------

function EditQuestionForm({
  question,
  onOpenChange,
}: {
  question: Question
  onOpenChange: (open: boolean) => void
}) {
  const updateQuestion = useUpdateQuestion()

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      difficulty: question.difficulty,
      text: question.text,
      explanation: question.explanation ?? '',
      tags: question.tags.join(', '),
    },
  })

  // Sync defaultValues when question prop changes (dialog reopened for different question)
  useEffect(() => {
    form.reset({
      difficulty: question.difficulty,
      text: question.text,
      explanation: question.explanation ?? '',
      tags: question.tags.join(', '),
    })
  }, [question.id, form]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: EditFormValues) {
    const tagsArray = values.tags
      ? values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
      : []

    try {
      await updateQuestion.mutateAsync({
        questionId: question.id,
        data: {
          text: values.text,
          difficulty: values.difficulty as Difficulty,
          explanation: values.explanation || undefined,
          tags: tagsArray,
        },
      })
      toast.success('Question updated')
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error('Failed to update question', { description: message })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <ScrollArea className="max-h-[62vh] pr-4">
          <div className="space-y-5 pb-1">
            {/* Info callout: options not editable */}
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Option texts and correct-answer key cannot be changed after creation. You
              can edit the question text, difficulty, explanation, and tags below.
            </div>

            {/* Difficulty */}
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Difficulty <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Select difficulty">
                        <SelectValue placeholder="Pick difficulty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Question text */}
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Question Text <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the question text…"
                      rows={4}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Explanation */}
            <FormField
              control={form.control}
              name="explanation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief explanation of the correct answer…"
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="kinematics, newton, velocity"
                      aria-label="Tags, comma-separated"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Up to 10 tags, 30 characters each.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateQuestion.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateQuestion.isPending}>
            {updateQuestion.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// ---------------------------------------------------------------------------
// QuestionFormDialog — public export
// ---------------------------------------------------------------------------

export function QuestionFormDialog({ open, onOpenChange, mode, question }: QuestionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Question' : 'Edit Question'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'create' ? (
          <CreateQuestionForm onOpenChange={onOpenChange} />
        ) : (
          <EditQuestionForm question={question} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  )
}
