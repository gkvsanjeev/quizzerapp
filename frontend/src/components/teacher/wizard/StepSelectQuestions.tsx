import { useState, useMemo, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { DifficultyBadge } from '@/components/teacher/DifficultyBadge'
import type { Question, Difficulty } from '@/types/question'
import type { Subject } from '@/types/exam'

// ── Props ────────────────────────────────────────────────────────────────────

interface StepSelectQuestionsProps {
  questions: Question[]
  questionsLoading: boolean
  subjects: Subject[]
  subjectsLoading: boolean
  selectedIds: Set<string>
  onToggleQuestion: (id: string) => void
  onToggleAll: (questions: Question[]) => void
  onBack: () => void
  onNext: () => void
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function QuestionRowSkeleton() {
  return (
    <TableRow aria-hidden="true">
      <TableCell className="w-10">
        <Skeleton className="h-4 w-4" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
    </TableRow>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function StepSelectQuestions({
  questions,
  questionsLoading,
  subjects,
  subjectsLoading,
  selectedIds,
  onToggleQuestion,
  onToggleAll,
  onBack,
  onNext,
}: StepSelectQuestionsProps) {
  const [searchInput, setSearchInput] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('__all__')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('__all__')

  // Client-side filtering (the hook already returns questions for the exam's
  // subject scope; further narrowing happens here to avoid extra round-trips
  // while keeping the UX snappy).
  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    return questions.filter((question) => {
      if (q && !question.text.toLowerCase().includes(q)) return false
      if (subjectFilter !== '__all__' && question.subject_id !== subjectFilter) return false
      if (difficultyFilter !== '__all__' && question.difficulty !== difficultyFilter) return false
      return true
    })
  }, [questions, searchInput, subjectFilter, difficultyFilter])

  // Header checkbox state
  const allChecked = filtered.length > 0 && filtered.every((q) => selectedIds.has(q.id))
  const someChecked = filtered.some((q) => selectedIds.has(q.id))
  const headerChecked: boolean | 'indeterminate' = allChecked
    ? true
    : someChecked
      ? 'indeterminate'
      : false

  const handleToggleAll = useCallback(() => {
    onToggleAll(filtered)
  }, [filtered, onToggleAll])

  // Subject name lookup
  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects],
  )

  const resultCount = filtered.length
  const totalCount = questions.length

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search questions…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1"
          aria-label="Search questions"
        />

        <Select
          value={subjectFilter}
          onValueChange={setSubjectFilter}
          disabled={subjectsLoading}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by subject">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by difficulty">
            <SelectValue placeholder="All difficulties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection stats */}
      <div
        className="flex items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedIds.size > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedIds.size} selected
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {questionsLoading
            ? 'Loading…'
            : `${resultCount} of ${totalCount} questions`}
        </span>
      </div>

      {/* Question list */}
      {questionsLoading ? (
        <div className="rounded-md border" aria-busy="true">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Question</TableHead>
                <TableHead className="w-36">Subject</TableHead>
                <TableHead className="w-28">Difficulty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <QuestionRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : questions.length === 0 ? (
        <Alert>
          <AlertDescription>
            This exam has no questions yet — add some in the Question Bank.
          </AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <Alert>
          <AlertDescription>
            No questions match your current filters. Try adjusting the search or filters.
          </AlertDescription>
        </Alert>
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={headerChecked}
                    onCheckedChange={handleToggleAll}
                    aria-label="Select all visible questions"
                  />
                </TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-36">Subject</TableHead>
                <TableHead className="w-28">Difficulty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((question) => (
                <TableRow
                  key={question.id}
                  className="cursor-pointer"
                  onClick={() => onToggleQuestion(question.id)}
                >
                  <TableCell
                    className="w-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(question.id)}
                      onCheckedChange={() => onToggleQuestion(question.id)}
                      aria-label={`Select question: ${question.text.slice(0, 60)}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-[380px]">
                    <span className="line-clamp-2 text-sm">{question.text}</span>
                  </TableCell>
                  <TableCell className="w-36 text-sm text-muted-foreground">
                    {subjectMap.get(question.subject_id) ?? '—'}
                  </TableCell>
                  <TableCell className="w-28">
                    <DifficultyBadge difficulty={question.difficulty as Difficulty} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Navigation footer */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={selectedIds.size === 0}
          aria-disabled={selectedIds.size === 0}
        >
          Next: Set Marks →
          {selectedIds.size > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-semibold">
              {selectedIds.size}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
