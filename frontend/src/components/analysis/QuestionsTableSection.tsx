import { useState } from 'react'

import { useQuestionList, useQuestionDetail } from '@/hooks/useAnalysis'
import type { QuestionListItem, QuestionListFilters, QuestionResult } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) {
    return `${m}m ${s}s`
  }
  return `${s}s`
}

function resultIcon(result: QuestionResult): string {
  switch (result) {
    case 'correct':
      return '✅'
    case 'incorrect':
      return '❌'
    case 'unattempted':
      return '—'
    default:
      return '—'
  }
}

function difficultyVariant(
  difficulty: string
): 'default' | 'secondary' | 'destructive' {
  switch (difficulty) {
    case 'easy':
      return 'default'
    case 'medium':
      return 'secondary'
    case 'hard':
      return 'destructive'
    default:
      return 'secondary'
  }
}

// ---------------------------------------------------------------------------
// Question Detail Modal
// ---------------------------------------------------------------------------

interface QuestionDetailModalProps {
  questionId: string | null
  attemptId: string | undefined
  onClose: () => void
}

function QuestionDetailModal({ questionId, attemptId, onClose }: QuestionDetailModalProps) {
  const { data, isLoading, isError } = useQuestionDetail(attemptId, questionId ?? undefined)

  if (!questionId) return null

  return (
    <Dialog open={!!questionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Question {data?.question_number}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load question details.</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-4">
            {/* Question info */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={difficultyVariant(data.difficulty)}>
                {data.difficulty}
              </Badge>
              <Badge variant="outline">{data.subject}</Badge>
              {data.topic && <Badge variant="outline">{data.topic}</Badge>}
            </div>

            {/* Question text */}
            <div className="rounded-md bg-muted p-4">
              <p className="whitespace-pre-wrap">{data.text}</p>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <h4 className="font-medium">Options</h4>
              {data.options.map((option) => (
                <div
                  key={option.option_key}
                  className={`rounded-md border p-3 ${
                    option.is_correct
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : option.selected
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                        : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.option_key}.</span>
                    <span>{option.text}</span>
                    {option.is_correct && <span className="text-green-600">✓</span>}
                    {option.selected && !option.is_correct && (
                      <span className="text-red-600">✗</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Your answer vs correct */}
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Your Answer: </span>
                <span className={data.is_correct ? 'text-green-600' : 'text-red-600'}>
                  {data.your_answer ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Correct Answer: </span>
                <span className="text-green-600">{data.correct_answer ?? '—'}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Time: {formatDuration(data.time_spent_seconds)}</span>
              <span>Visits: {data.visit_count}</span>
              {data.change_count > 0 && <span>Changes: {data.change_count}</span>}
              {data.is_marked_for_review && (
                <Badge variant="outline" className="text-xs">Marked for Review</Badge>
              )}
            </div>

            {/* Explanation */}
            {data.explanation && (
              <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-950/20">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Explanation</h4>
                <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                  {data.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Filter Controls
// ---------------------------------------------------------------------------

interface FilterControlsProps {
  filters: QuestionListFilters
  onFiltersChange: (filters: QuestionListFilters) => void
}

function FilterControls({ filters, onFiltersChange }: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={filters.result || 'all'}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            result: value === 'all' ? undefined : (value as QuestionResult),
          })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Result" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Results</SelectItem>
          <SelectItem value="correct">Correct</SelectItem>
          <SelectItem value="incorrect">Incorrect</SelectItem>
          <SelectItem value="unattempted">Unattempted</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Questions Table
// ---------------------------------------------------------------------------

interface QuestionsTableProps {
  questions: QuestionListItem[]
  onRowClick: (questionId: string) => void
}

function QuestionsTable({ questions, onRowClick }: QuestionsTableProps) {
  if (questions.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No questions match the selected filters.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-3 text-left font-medium">Q#</th>
            <th className="px-3 py-3 text-left font-medium">Subject</th>
            <th className="px-3 py-3 text-left font-medium">Topic</th>
            <th className="px-3 py-3 text-left font-medium">Difficulty</th>
            <th className="px-3 py-3 text-left font-medium">Your Answer</th>
            <th className="px-3 py-3 text-left font-medium">Correct</th>
            <th className="px-3 py-3 text-center font-medium">Result</th>
            <th className="px-3 py-3 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {questions.map((q) => (
            <tr
              key={q.question_id}
              className="hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onRowClick(q.question_id)}
            >
              <td className="px-3 py-3 font-medium">{q.question_number}</td>
              <td className="px-3 py-3">{q.subject}</td>
              <td className="px-3 py-3 text-muted-foreground">{q.topic || '—'}</td>
              <td className="px-3 py-3">
                <Badge variant={difficultyVariant(q.difficulty)} className="text-xs">
                  {q.difficulty}
                </Badge>
              </td>
              <td className="px-3 py-3">{q.your_answer || '—'}</td>
              <td className="px-3 py-3">{q.correct_answer || '—'}</td>
              <td className="px-3 py-3 text-center text-lg">{resultIcon(q.result)}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">
                {formatDuration(q.time_spent_seconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function QuestionsTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading questions data">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-[150px]" />
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface QuestionsTableSectionProps {
  attemptId: string | undefined
}

export function QuestionsTableSection({ attemptId }: QuestionsTableSectionProps) {
  const [filters, setFilters] = useState<QuestionListFilters>({})
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuestionList(attemptId, filters)

  if (isLoading) {
    return <QuestionsTableSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load questions. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <FilterControls filters={filters} onFiltersChange={setFilters} />

      {/* Table */}
      {data?.questions ? (
        <QuestionsTable
          questions={data.questions}
          onRowClick={setSelectedQuestionId}
        />
      ) : (
        <p className="text-muted-foreground">No questions available.</p>
      )}

      {/* Detail Modal */}
      <QuestionDetailModal
        questionId={selectedQuestionId}
        attemptId={attemptId}
        onClose={() => setSelectedQuestionId(null)}
      />
    </div>
  )
}