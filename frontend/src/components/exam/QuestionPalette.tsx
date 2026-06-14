import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useExamSessionStore, questionStatus } from '@/store/examSessionStore'
import type { QuestionStatus } from '@/store/examSessionStore'
import { cn } from '@/lib/utils'

// Status label map for aria-labels and tooltip text
const STATUS_LABELS: Record<QuestionStatus, string> = {
  unanswered: 'Unanswered',
  answered: 'Answered',
  marked: 'Marked for review',
  'answered-marked': 'Answered and marked',
}

// Tailwind classes per status
const STATUS_CLASSES: Record<QuestionStatus, string> = {
  unanswered: 'bg-muted text-muted-foreground hover:bg-muted/80',
  answered: 'bg-emerald-500 text-white hover:bg-emerald-600',
  marked: 'bg-amber-400 text-white hover:bg-amber-500',
  'answered-marked': 'bg-purple-500 text-white hover:bg-purple-600',
}

// Legend colour squares
const LEGEND_COLOUR_CLASSES: Record<QuestionStatus, string> = {
  unanswered: 'bg-muted border border-border',
  answered: 'bg-emerald-500',
  marked: 'bg-amber-400',
  'answered-marked': 'bg-purple-500',
}

interface LegendItemProps {
  status: QuestionStatus
}

function LegendItem({ status }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn('inline-block h-3 w-3 shrink-0 rounded-sm', LEGEND_COLOUR_CLASSES[status])}
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
    </div>
  )
}

export function QuestionPalette() {
  // Fine-grained selectors — never timeElapsedSeconds
  const questions = useExamSessionStore((s) => s.questions)
  const currentIndex = useExamSessionStore((s) => s.currentIndex)
  const localAnswers = useExamSessionStore((s) => s.localAnswers)
  const markedForReview = useExamSessionStore((s) => s.markedForReview)
  const goToQuestion = useExamSessionStore((s) => s.goToQuestion)

  // Derive summary counts inline
  const answeredCount = questions.filter((q) => Boolean(localAnswers[q.id])).length
  const markedCount = questions.filter((q) => Boolean(markedForReview[q.id])).length

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-sm font-semibold">Question Palette</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {answeredCount} answered
          </span>
          {markedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {markedCount} marked
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {questions.length - answeredCount} left
          </span>
        </div>
      </header>

      {/* Palette grid */}
      <ScrollArea className="flex-1">
        <div
          role="group"
          aria-label="Question navigation palette"
          className="grid grid-cols-5 gap-1.5 pr-2"
        >
          {questions.map((q, i) => {
            const status = questionStatus(q.id, localAnswers, markedForReview)
            const isCurrent = i === currentIndex
            const statusLabel = STATUS_LABELS[status]

            return (
              <Tooltip key={q.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => goToQuestion(i)}
                    aria-label={`Question ${i + 1}, ${statusLabel}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={cn(
                      'h-8 w-full p-0 text-xs font-medium transition-all',
                      STATUS_CLASSES[status],
                      isCurrent && 'ring-2 ring-primary ring-offset-1',
                    )}
                  >
                    {i + 1}
                  </Button>
                </TooltipTrigger>
                <TooltipContent aria-hidden="true">
                  <p>Q{i + 1} — {statusLabel}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </ScrollArea>

      <Separator />

      {/* Legend */}
      <footer className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <LegendItem status="unanswered" />
        <LegendItem status="answered" />
        <LegendItem status="marked" />
        <LegendItem status="answered-marked" />
      </footer>
    </div>
  )
}
