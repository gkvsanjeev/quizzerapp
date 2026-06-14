import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { TeacherPageShell } from '@/components/teacher/TeacherPageShell'
import { CreateExamDialog } from '@/components/teacher/CreateExamDialog'
import { ExamCard } from '@/components/teacher/ExamCard'
import { useExams } from '@/hooks/useExams'

// ---------------------------------------------------------------------------
// Loading skeleton for the card grid
// ---------------------------------------------------------------------------

function ExamCardSkeleton() {
  return (
    <div
      className="rounded-lg border bg-card p-4 shadow-sm space-y-3"
      aria-hidden="true"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Description lines */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      {/* Divider */}
      <Skeleton className="h-px w-full" />
      {/* Subject chips */}
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      {/* Input row */}
      <Skeleton className="h-7 w-full rounded-md" />
      {/* Footer */}
      <Skeleton className="h-4 w-1/3 mt-2" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Create Exam" button — rendered in the shell's action slot
// ---------------------------------------------------------------------------

interface CreateExamButtonProps {
  onClick: () => void
}

function CreateExamButton({ onClick }: CreateExamButtonProps) {
  return (
    <Button onClick={onClick} className="gap-2">
      <PlusCircle className="h-4 w-4" aria-hidden="true" />
      Create Exam
    </Button>
  )
}

// ---------------------------------------------------------------------------
// ExamsPage — default export (required by router)
// ---------------------------------------------------------------------------

export default function ExamsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, isError } = useExams()
  const exams = data?.items ?? []

  return (
    <>
      <TeacherPageShell
        title="Exams"
        description="Create and manage exam series and their subjects."
        action={<CreateExamButton onClick={() => setDialogOpen(true)} />}
      >
        {/* ---- Loading state ---- */}
        {isLoading && (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading exams"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ExamCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ---- Error state ---- */}
        {isError && !isLoading && (
          <Alert variant="destructive" className="max-w-xl">
            <AlertDescription>
              Failed to load exams. Please refresh the page or try again later.
            </AlertDescription>
          </Alert>
        )}

        {/* ---- Empty state ---- */}
        {!isLoading && !isError && exams.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 py-16 text-center">
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">No exams yet</p>
              <p className="text-sm text-muted-foreground">
                Get started by creating your first exam series.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Create your first exam
            </Button>
          </div>
        )}

        {/* ---- Exam card grid ---- */}
        {!isLoading && !isError && exams.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}
      </TeacherPageShell>

      {/* ---- Create Exam dialog — rendered outside shell for proper portal stacking ---- */}
      <CreateExamDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
