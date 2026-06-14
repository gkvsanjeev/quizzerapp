import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal, Plus, AlertCircle, SearchX } from 'lucide-react'

import { TeacherPageShell } from '@/components/teacher/TeacherPageShell'
import { DifficultyBadge } from '@/components/teacher/DifficultyBadge'
import { QuestionFormDialog } from '@/components/teacher/QuestionFormDialog'
import { DeleteQuestionDialog } from '@/components/teacher/DeleteQuestionDialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { useQuestions, useDeleteQuestion } from '@/hooks/useQuestions'
import { useExams, useExamSubjects, useSubjectNameMap } from '@/hooks/useExams'
import type { Question, QuestionFilters, Difficulty } from '@/types/question'

// ---------------------------------------------------------------------------
// Types / constants
// ---------------------------------------------------------------------------

type DialogMode = 'create' | 'edit' | null

const SKELETON_ROWS = 5
const DEBOUNCE_MS = 300

// ---------------------------------------------------------------------------
// Filter panel
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  searchInput: string
  onSearchChange: (v: string) => void
  filterExamId: string
  onFilterExamChange: (v: string) => void
  filterSubjectId: string
  onFilterSubjectChange: (v: string) => void
  filterDifficulty: string
  onFilterDifficultyChange: (v: string) => void
}

function FilterPanel({
  searchInput,
  onSearchChange,
  filterExamId,
  onFilterExamChange,
  filterSubjectId,
  onFilterSubjectChange,
  filterDifficulty,
  onFilterDifficultyChange,
}: FilterPanelProps) {
  const { data: examsData, isLoading: examsLoading } = useExams()
  const exams = examsData?.items ?? []

  const { data: subjectsData, isLoading: subjectsLoading } = useExamSubjects(
    filterExamId || undefined,
  )
  const subjects = subjectsData ?? []

  function handleExamChange(value: string) {
    onFilterExamChange(value === '__all__' ? '' : value)
    onFilterSubjectChange('') // reset subject when exam changes
  }

  function handleSubjectChange(value: string) {
    onFilterSubjectChange(value === '__all__' ? '' : value)
  }

  function handleDifficultyChange(value: string) {
    onFilterDifficultyChange(value === '__all__' ? '' : value)
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {/* Search */}
          <div className="flex flex-col gap-1.5 sm:flex-1 sm:min-w-[180px]">
            <Label htmlFor="q-search" className="text-xs font-medium text-muted-foreground">
              Search
            </Label>
            <Input
              id="q-search"
              placeholder="Search questions…"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search questions"
              className="h-9"
            />
          </div>

          {/* Exam filter */}
          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label htmlFor="filter-exam" className="text-xs font-medium text-muted-foreground">
              Exam
            </Label>
            <Select
              value={filterExamId || '__all__'}
              onValueChange={handleExamChange}
              disabled={examsLoading}
            >
              <SelectTrigger id="filter-exam" className="h-9" aria-label="Filter by exam">
                <SelectValue placeholder="All exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All exams</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject filter */}
          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label htmlFor="filter-subject" className="text-xs font-medium text-muted-foreground">
              Subject
            </Label>
            <Select
              value={filterSubjectId || '__all__'}
              onValueChange={handleSubjectChange}
              disabled={!filterExamId || subjectsLoading}
            >
              <SelectTrigger
                id="filter-subject"
                className="h-9"
                aria-label="Filter by subject"
              >
                <SelectValue
                  placeholder={!filterExamId ? 'Pick exam first' : 'All subjects'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty filter */}
          <div className="flex flex-col gap-1.5 sm:w-36">
            <Label
              htmlFor="filter-difficulty"
              className="text-xs font-medium text-muted-foreground"
            >
              Difficulty
            </Label>
            <Select
              value={filterDifficulty || '__all__'}
              onValueChange={handleDifficultyChange}
            >
              <SelectTrigger
                id="filter-difficulty"
                className="h-9"
                aria-label="Filter by difficulty"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Table row skeleton
// ---------------------------------------------------------------------------

function TableRowSkeleton() {
  return (
    <TableRow aria-hidden="true">
      {[50, 20, 15, 10, 5].map((w, i) => (
        <TableCell key={i}>
          <Skeleton className={`h-4 w-[${w}%]`} />
        </TableCell>
      ))}
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Row actions dropdown
// ---------------------------------------------------------------------------

interface RowActionsProps {
  question: Question
  onEdit: (q: Question) => void
  onDelete: (q: Question) => void
}

function RowActions({ question, onEdit, onDelete }: RowActionsProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              aria-label={`Open actions for question: ${question.text.slice(0, 40)}`}
            >
              <span className="sr-only">Open actions</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onEdit(question)}
          aria-label="Edit question"
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(question)}
          className="text-destructive focus:text-destructive"
          aria-label="Delete question"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// QuestionBankPage — default export
// ---------------------------------------------------------------------------

export default function QuestionBankPage() {
  // ---- filter state --------------------------------------------------------
  const [searchInput, setSearchInput] = useState('')
  const [filterExamId, setFilterExamId] = useState('')
  const [filterSubjectId, setFilterSubjectId] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')

  // debounced filters fed into query
  const [debouncedFilters, setDebouncedFilters] = useState<QuestionFilters>({})

  // ---- dialog state --------------------------------------------------------
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [editTarget, setEditTarget] = useState<Question | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)

  // ---- build debounced filters --------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      const next: QuestionFilters = {}
      if (filterSubjectId) next.subject_id = filterSubjectId
      if (filterDifficulty) next.difficulty = filterDifficulty as Difficulty
      setDebouncedFilters(next)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filterSubjectId, filterDifficulty, searchInput])

  // ---- data ----------------------------------------------------------------
  const { data, isLoading, isError, error } = useQuestions(debouncedFilters)
  const questions: Question[] = data?.items ?? []

  const subjectNames = useSubjectNameMap()

  const deleteQuestion = useDeleteQuestion()

  // ---- handlers ------------------------------------------------------------
  const handleOpenCreate = useCallback(() => {
    setEditTarget(null)
    setDialogMode('create')
  }, [])

  const handleOpenEdit = useCallback((q: Question) => {
    setEditTarget(q)
    setDialogMode('edit')
  }, [])

  const handleOpenDelete = useCallback((q: Question) => {
    setDeleteTarget(q)
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDialogMode(null)
      setEditTarget(null)
    }
  }, [])

  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteQuestion.mutateAsync(deleteTarget.id)
      toast.success('Question deleted')
      setDeleteTarget(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error('Failed to delete question', { description: message })
    }
  }, [deleteTarget, deleteQuestion])

  // ---- computed counts for aria-live ---------------------------------------
  const resultDescription = isLoading
    ? 'Loading questions…'
    : `${questions.length} question${questions.length !== 1 ? 's' : ''} found`

  // ---- render --------------------------------------------------------------
  return (
    <TooltipProvider delayDuration={300}>
    <TeacherPageShell
      title="Question Bank"
      description="Manage your reusable question pool. Add, edit, or remove questions across all subjects."
      action={
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Question
        </Button>
      }
    >
      {/* Filter panel */}
      <FilterPanel
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        filterExamId={filterExamId}
        onFilterExamChange={setFilterExamId}
        filterSubjectId={filterSubjectId}
        onFilterSubjectChange={setFilterSubjectId}
        filterDifficulty={filterDifficulty}
        onFilterDifficultyChange={setFilterDifficulty}
      />

      <Separator className="my-4" />

      {/* Accessible live region announcing result count */}
      <p
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {resultDescription}
      </p>

      {/* Error state */}
      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : 'Failed to load questions. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-md border" aria-busy={isLoading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44%]">Question</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-28">Difficulty</TableHead>
              <TableHead className="w-24">Options</TableHead>
              <TableHead className="w-14 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Loading skeletons */}
            {isLoading &&
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}

            {/* Empty state — no data and not loading */}
            {!isLoading && !isError && questions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <SearchX className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {filterSubjectId || filterDifficulty || searchInput
                          ? 'No questions match your filters'
                          : 'No questions yet'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {filterSubjectId || filterDifficulty || searchInput
                          ? 'Try clearing some filters to see more results.'
                          : 'Add your first question to get started.'}
                      </p>
                    </div>
                    {!filterSubjectId && !filterDifficulty && !searchInput && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenCreate}
                        className="mt-1 gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add your first question
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Data rows */}
            {!isLoading &&
              questions.map((q, index) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  index={index}
                  subjectName={subjectNames.get(q.subject_id)}
                  onEdit={handleOpenEdit}
                  onDelete={handleOpenDelete}
                />
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {dialogMode === 'create' && (
        <QuestionFormDialog
          mode="create"
          open={dialogMode === 'create'}
          onOpenChange={handleDialogOpenChange}
        />
      )}

      {dialogMode === 'edit' && editTarget && (
        <QuestionFormDialog
          mode="edit"
          question={editTarget}
          open={dialogMode === 'edit'}
          onOpenChange={handleDialogOpenChange}
        />
      )}

      {deleteTarget && (
        <DeleteQuestionDialog
          open={Boolean(deleteTarget)}
          onOpenChange={handleDeleteOpenChange}
          questionText={deleteTarget.text}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteQuestion.isPending}
        />
      )}
    </TeacherPageShell>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// QuestionRow — extracted to avoid re-defining functions in map
// ---------------------------------------------------------------------------

interface QuestionRowProps {
  question: Question
  index: number
  subjectName?: string
  onEdit: (q: Question) => void
  onDelete: (q: Question) => void
}

function QuestionRow({ question, subjectName, onEdit, onDelete }: QuestionRowProps) {
  const truncatedText =
    question.text.length > 120
      ? `${question.text.slice(0, 120)}…`
      : question.text

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span
          title={question.text}
          className="block max-w-xs truncate sm:max-w-sm lg:max-w-none"
        >
          {truncatedText}
        </span>
        {question.tags.length > 0 && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {question.tags.slice(0, 3).join(', ')}
            {question.tags.length > 3 && ` +${question.tags.length - 3} more`}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {subjectName ?? <span className="text-muted-foreground/50">—</span>}
      </TableCell>
      <TableCell>
        <DifficultyBadge difficulty={question.difficulty} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {question.options.length} options
      </TableCell>
      <TableCell className="text-right">
        <RowActions question={question} onEdit={onEdit} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  )
}
