import { useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DifficultyBadge } from '@/components/teacher/DifficultyBadge'
import { useExamSessionStore } from '@/store/examSessionStore'
import { useSaveAnswer } from '@/hooks/useAttempts'
import { cn } from '@/lib/utils'

interface QuestionDisplayProps {
  attemptId: string
}

export function QuestionDisplay({ attemptId }: QuestionDisplayProps) {
  // Fine-grained selectors — never subscribe to timeElapsedSeconds here
  const questions = useExamSessionStore((s) => s.questions)
  const currentIndex = useExamSessionStore((s) => s.currentIndex)
  const localAnswers = useExamSessionStore((s) => s.localAnswers)
  const markedForReview = useExamSessionStore((s) => s.markedForReview)
  const setAnswer = useExamSessionStore((s) => s.setAnswer)
  const markForReview = useExamSessionStore((s) => s.markForReview)
  const nextQuestion = useExamSessionStore((s) => s.nextQuestion)
  const prevQuestion = useExamSessionStore((s) => s.prevQuestion)

  const saveAnswer = useSaveAnswer()

  // Track dwell time per question
  const questionShownAtRef = useRef<number>(Date.now())

  useEffect(() => {
    questionShownAtRef.current = Date.now()
  }, [currentIndex])

  const question = questions[currentIndex]

  if (!question) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No question available.
      </div>
    )
  }

  const currentAnswer = localAnswers[question.id] ?? ''
  const isMarked = Boolean(markedForReview[question.id])
  const hasAnswer = Boolean(localAnswers[question.id])

  function getDwellSeconds(): number {
    return Math.round((Date.now() - questionShownAtRef.current) / 1000)
  }

  function handleAnswerChange(optionId: string) {
    setAnswer(question.id, optionId)
    saveAnswer.mutate(
      {
        attemptId,
        data: {
          question_id: question.id,
          selected_option_id: optionId,
          time_spent_delta_seconds: getDwellSeconds(),
        },
      },
      {
        onError: () => {
          toast.error('Failed to save answer. Your selection is kept locally.')
        },
      },
    )
    // Reset dwell timer after saving
    questionShownAtRef.current = Date.now()
  }

  function handleClearResponse() {
    setAnswer(question.id, null)
    saveAnswer.mutate(
      {
        attemptId,
        data: {
          question_id: question.id,
          selected_option_id: null,
          time_spent_delta_seconds: getDwellSeconds(),
        },
      },
      {
        onError: () => {
          toast.error('Failed to clear answer. Your change is kept locally.')
        },
      },
    )
    questionShownAtRef.current = Date.now()
  }

  function handleMarkForReview() {
    const nextMarked = !isMarked
    markForReview(question.id)
    saveAnswer.mutate(
      {
        attemptId,
        data: {
          question_id: question.id,
          is_marked_for_review: nextMarked,
        },
      },
      {
        onError: () => {
          toast.error('Failed to save review mark. Your change is kept locally.')
        },
      },
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Question meta row */}
      <header className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <DifficultyBadge difficulty={question.difficulty} />
      </header>

      {/* Question stem */}
      <div className="flex flex-col gap-3">
        <p className="text-base leading-relaxed">{question.text}</p>
        {question.image_url && (
          <img
            src={question.image_url}
            alt={`Question ${currentIndex + 1} diagram`}
            className="max-h-64 w-auto rounded-md border object-contain"
          />
        )}
      </div>

      <Separator />

      {/* Options */}
      <RadioGroup
        value={currentAnswer}
        onValueChange={handleAnswerChange}
        aria-label={`Answer options for question ${currentIndex + 1}`}
        className="flex flex-col gap-2"
      >
        {question.options.map((option) => {
          const isSelected = currentAnswer === option.id
          return (
            <div
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <RadioGroupItem
                value={option.id}
                id={option.id}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor={option.id}
                className="flex flex-1 cursor-pointer flex-col gap-1"
              >
                <div className="flex items-baseline gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                    {option.option_key}
                  </span>
                  <span className="text-sm leading-snug">{option.text}</span>
                </div>
                {option.image_url && (
                  <img
                    src={option.image_url}
                    alt={`Option ${option.option_key} diagram`}
                    className="mt-1 max-h-32 w-auto rounded object-contain"
                  />
                )}
              </Label>
            </div>
          )
        })}
      </RadioGroup>

      {/* Footer action buttons */}
      <div
        role="group"
        aria-label="Question navigation"
        className="mt-auto flex flex-wrap items-center gap-2 pt-2"
      >
        <Button
          variant="outline"
          onClick={prevQuestion}
          disabled={currentIndex === 0}
          className="min-w-[90px]"
        >
          Previous
        </Button>

        <Button
          variant="outline"
          onClick={handleMarkForReview}
          aria-pressed={isMarked}
          className={cn(
            'min-w-[140px]',
            isMarked && 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800',
          )}
        >
          {isMarked ? 'Marked for Review' : 'Mark for Review'}
        </Button>

        <Button
          variant="ghost"
          onClick={handleClearResponse}
          disabled={!hasAnswer}
          aria-disabled={!hasAnswer}
          className="min-w-[120px]"
        >
          Clear Response
        </Button>

        <Button
          onClick={nextQuestion}
          disabled={currentIndex === questions.length - 1}
          className="ml-auto min-w-[90px]"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
