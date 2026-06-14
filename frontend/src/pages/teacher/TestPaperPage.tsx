import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { TeacherPageShell } from '@/components/teacher/TeacherPageShell'
import { StepSettings, type PaperSettingsFormValues } from '@/components/teacher/wizard/StepSettings'
import { StepSelectQuestions } from '@/components/teacher/wizard/StepSelectQuestions'
import { StepMarks, type MarksRowState } from '@/components/teacher/wizard/StepMarks'

import { useExams, useExamSubjects } from '@/hooks/useExams'
import { useQuestions } from '@/hooks/useQuestions'
import { useCreateTestPaper, useAddQuestionsToPaper } from '@/hooks/useTestPapers'

import type { Question } from '@/types/question'

// ── Step metadata ─────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3

interface StepMeta {
  label: string
  title: string
  description: string
}

const STEP_META: Record<WizardStep, StepMeta> = {
  1: {
    label: '1. Settings',
    title: 'Paper Settings',
    description: 'Name the test paper, set the duration and marks, and configure options.',
  },
  2: {
    label: '2. Questions',
    title: 'Select Questions',
    description: 'Choose which questions from this exam to include in the paper.',
  },
  3: {
    label: '3. Marks & Confirm',
    title: 'Assign Marks',
    description: 'Set marks and negative marks per question, then create the paper.',
  },
}

const STEP_PERCENT: Record<WizardStep, number> = { 1: 33, 2: 66, 3: 100 }

// ── Page component ────────────────────────────────────────────────────────────

export default function TestPaperPage() {
  const navigate = useNavigate()

  // ── Wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(1)
  const [settingsData, setSettingsData] = useState<PaperSettingsFormValues | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [marksRows, setMarksRows] = useState<MarksRowState[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Server state ──────────────────────────────────────────────────────────
  const { data: examsData, isLoading: examsLoading } = useExams()
  const exams = examsData?.items ?? []

  // Exam subjects — only active once an exam is selected
  const selectedExamId = settingsData?.exam_id ?? ''
  const { data: subjects = [], isLoading: subjectsLoading } = useExamSubjects(
    selectedExamId || undefined,
  )

  // Questions for the selected exam — filtered by exam via subject ids
  // The API accepts subject_id; pass undefined when none selected so we get
  // all questions the exam owns (across all its subjects).
  const { data: questionsData, isLoading: questionsLoading } = useQuestions(
    selectedExamId
      ? {}  // fetch all, then client-filter in StepSelectQuestions
      : {},
  )
  const allQuestions: Question[] = questionsData?.items ?? []

  // Filter to only questions belonging to the selected exam's subjects
  const examSubjectIds = new Set(subjects.map((s) => s.id))
  const examQuestions =
    selectedExamId && subjects.length > 0
      ? allQuestions.filter((q) => examSubjectIds.has(q.subject_id))
      : selectedExamId
        ? allQuestions  // subjects not loaded yet — show all until we can filter
        : []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createTestPaper = useCreateTestPaper()
  const addQuestionsToPaper = useAddQuestionsToPaper()

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Step 1 → 2
  const handleSettingsNext = useCallback((values: PaperSettingsFormValues) => {
    setSettingsData(values)
    setSubmitError(null)
    setStep(2)
  }, [])

  // Toggle a single question
  const handleToggleQuestion = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Toggle all visible questions (from filtered list passed by StepSelectQuestions)
  const handleToggleAll = useCallback((questions: Question[]) => {
    setSelectedIds((prev) => {
      const allSelected = questions.every((q) => prev.has(q.id))
      if (allSelected) {
        // Deselect only the visible ones, keep others
        const next = new Set(prev)
        questions.forEach((q) => next.delete(q.id))
        return next
      } else {
        const next = new Set(prev)
        questions.forEach((q) => next.add(q.id))
        return next
      }
    })
  }, [])

  // Step 2 → 3: initialise marks rows from selected questions
  const handleQuestionsNext = useCallback(() => {
    const selected = examQuestions.filter((q) => selectedIds.has(q.id))
    const rows: MarksRowState[] = selected.map((q, i) => ({
      question_id: q.id,
      question_text: q.text,
      difficulty: q.difficulty,
      marks: 4,
      negative_marks: 1,
      display_order: i + 1,
    }))
    setMarksRows(rows)
    setSubmitError(null)
    setStep(3)
  }, [examQuestions, selectedIds])

  // Update a single marks row field
  const handleUpdateRow = useCallback(
    (index: number, field: 'marks' | 'negative_marks' | 'display_order', value: number) => {
      setMarksRows((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    [],
  )

  // Step 3 → submit
  const handleSubmit = useCallback(async () => {
    if (!settingsData) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const paper = await createTestPaper.mutateAsync({
        examId: settingsData.exam_id,
        data: {
          title: settingsData.title,
          duration_seconds: settingsData.duration * 60,
          total_marks: settingsData.total_marks,
          negative_marking_factor: settingsData.negative_marking_factor,
          shuffle_questions: settingsData.shuffle_questions,
          shuffle_options: settingsData.shuffle_options,
        },
      })

      const items = marksRows.map((row) => ({
        question_id: row.question_id,
        display_order: row.display_order,
        marks: row.marks,
        negative_marks: row.negative_marks,
      }))

      await addQuestionsToPaper.mutateAsync({ paperId: paper.id, items })

      toast.success('Test paper created', {
        description: `"${paper.title}" — ${items.length} question${items.length === 1 ? '' : 's'} added.`,
      })

      // Reset wizard
      setStep(1)
      setSettingsData(null)
      setSelectedIds(new Set())
      setMarksRows([])
      navigate('/teacher/exams')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setSubmitError(message)
      toast.error('Failed to create test paper', { description: message })
    } finally {
      setSubmitting(false)
    }
  }, [settingsData, marksRows, createTestPaper, addQuestionsToPaper, navigate])

  // ── Render ────────────────────────────────────────────────────────────────

  const meta = STEP_META[step]

  return (
    <TeacherPageShell
      title="Create Test Paper"
      description="Compose a new test paper in three steps: settings, questions, and marks."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Step indicator */}
        <div className="space-y-2" role="navigation" aria-label="Wizard steps">
          <Progress
            value={STEP_PERCENT[step]}
            className="h-2"
            aria-label={`Step ${step} of 3`}
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={3}
          />
          <div className="flex justify-between">
            {([1, 2, 3] as WizardStep[]).map((s) => (
              <span
                key={s}
                aria-current={step === s ? 'step' : undefined}
                className={
                  step === s
                    ? 'text-xs font-semibold text-foreground'
                    : step > s
                      ? 'text-xs text-muted-foreground/60'
                      : 'text-xs text-muted-foreground'
                }
              >
                {STEP_META[s].label}
              </span>
            ))}
          </div>
        </div>

        <Separator />

        {/* Submit error alert (shown above the card so it is visible) */}
        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Wizard card */}
        <Card>
          <CardHeader>
            <CardTitle>{meta.title}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </CardHeader>

          <CardContent>
            {step === 1 && (
              <StepSettings
                exams={exams}
                examsLoading={examsLoading}
                defaultValues={settingsData ?? undefined}
                onNext={handleSettingsNext}
              />
            )}

            {step === 2 && (
              <StepSelectQuestions
                questions={examQuestions}
                questionsLoading={questionsLoading || subjectsLoading}
                subjects={subjects}
                subjectsLoading={subjectsLoading}
                selectedIds={selectedIds}
                onToggleQuestion={handleToggleQuestion}
                onToggleAll={handleToggleAll}
                onBack={() => setStep(1)}
                onNext={handleQuestionsNext}
              />
            )}

            {step === 3 && (
              <StepMarks
                rows={marksRows}
                onUpdateRow={handleUpdateRow}
                onBack={() => setStep(2)}
                onSubmit={handleSubmit}
                isSubmitting={submitting}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherPageShell>
  )
}
