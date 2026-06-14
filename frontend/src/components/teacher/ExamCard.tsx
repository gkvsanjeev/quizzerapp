import { useState, useRef, type KeyboardEvent } from 'react'
import { Plus, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useExamSubjects, useCreateSubject } from '@/hooks/useExams'
import type { Exam } from '@/types/exam'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SubjectChip({ name, topicCount }: { name: string; topicCount: number }) {
  const label =
    topicCount > 0 ? `${name} — ${topicCount} topic${topicCount !== 1 ? 's' : ''}` : name

  if (topicCount === 0) {
    return (
      <Badge variant="secondary" className="shrink-0 cursor-default text-xs">
        {name}
      </Badge>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className="shrink-0 cursor-default text-xs"
          aria-label={label}
        >
          {name}
          <span className="ml-1 text-muted-foreground">({topicCount})</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{topicCount} topic{topicCount !== 1 ? 's' : ''}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// ExamCard
// ---------------------------------------------------------------------------

interface ExamCardProps {
  exam: Exam
}

export function ExamCard({ exam }: ExamCardProps) {
  const [subjectInput, setSubjectInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: subjects, isLoading: subjectsLoading } = useExamSubjects(exam.id)
  const createSubject = useCreateSubject()

  async function handleAddSubject() {
    const name = subjectInput.trim()
    if (name.length < 2) {
      toast.error('Subject name must be at least 2 characters.')
      inputRef.current?.focus()
      return
    }
    try {
      await createSubject.mutateAsync({ examId: exam.id, data: { name } })
      toast.success('Subject added', { description: `"${name}" added to ${exam.title}.` })
      setSubjectInput('')
      inputRef.current?.focus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error('Failed to add subject', { description: message })
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSubject()
    }
  }

  return (
    <Card className="flex flex-col transition-shadow duration-200 hover:shadow-md">
      {/* ---- Header ---- */}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {exam.title}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {exam.is_published ? (
              <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                Published
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Draft
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {exam.exam_type}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* ---- Content ---- */}
      <CardContent className="flex flex-1 flex-col gap-3 pb-3">
        {/* Description */}
        {exam.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
        )}

        <Separator />

        {/* Subjects section */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Subjects
          </p>

          {/* Subject chips */}
          {subjectsLoading ? (
            <div className="flex flex-wrap gap-1.5" aria-busy="true" aria-label="Loading subjects">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ) : subjects && subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="Subjects">
              {subjects.map((subject) => (
                <span key={subject.id} role="listitem">
                  <SubjectChip name={subject.name} topicCount={subject.topics?.length ?? 0} />
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No subjects yet. Add one below.</p>
          )}

          {/* Add subject inline */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              ref={inputRef}
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New subject name…"
              className="h-7 text-xs"
              aria-label={`Add subject to ${exam.title}`}
              disabled={createSubject.isPending}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={handleAddSubject}
                  disabled={createSubject.isPending}
                  aria-label={`Add subject to ${exam.title}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Add subject</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>

      {/* ---- Footer ---- */}
      <CardFooter className="border-t pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>Created {formatDate(exam.created_at)}</span>
        </div>
      </CardFooter>
    </Card>
  )
}
