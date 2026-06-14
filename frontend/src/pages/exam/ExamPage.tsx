import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Maximize2, Minimize2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ExamTimer } from '@/components/exam/ExamTimer'
import { QuestionDisplay } from '@/components/exam/QuestionDisplay'
import { QuestionPalette } from '@/components/exam/QuestionPalette'
import { useExamSessionStore } from '@/store/examSessionStore'
import { useAttempt, useSubmitAttempt } from '@/hooks/useAttempts'

// Loading skeleton that mirrors the two-column exam layout
function ExamPageSkeleton() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-14 items-center gap-4 border-b px-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="ml-auto h-5 w-24" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="mb-6 h-20 w-full" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="w-72 border-l p-4">
          <Skeleton className="mb-3 h-5 w-36" />
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExamPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()

  const [submitOpen, setSubmitOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fine-grained selectors
  const syncFromServer = useExamSessionStore((s) => s.syncFromServer)
  const setPaused = useExamSessionStore((s) => s.setPaused)
  const reset = useExamSessionStore((s) => s.reset)
  const testPaper = useExamSessionStore((s) => s.testPaper)
  const questions = useExamSessionStore((s) => s.questions)
  const localAnswers = useExamSessionStore((s) => s.localAnswers)
  const storeAttemptId = useExamSessionStore((s) => s.attemptId)

  const { data, isLoading, isError } = useAttempt(attemptId)
  const submitMutation = useSubmitAttempt()

  // Sync server data into the store exactly once per attemptId
  useEffect(() => {
    if (data) {
      syncFromServer(data)
    }
  }, [data?.attempt_id])

  // Pause timer on unmount (e.g. user navigates away without submitting)
  useEffect(() => {
    return () => {
      setPaused(true)
    }
  }, [])

  // Track fullscreen state changes (user can also press Escape to exit)
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Warn user before accidental navigation away
  useEffect(() => {
    if (!attemptId) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Modern browsers show a generic message regardless of returnValue
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [attemptId])

  function toggleFullscreen() {
    if (!document.fullscreenEnabled) return

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        toast.error('Could not exit full screen.')
      })
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error('Could not enter full screen.')
      })
    }
  }

  // Derive stats for the submit dialog
  const answeredCount = Object.values(localAnswers).filter(Boolean).length
  const unansweredCount = questions.length - answeredCount

  const handleConfirmSubmit = useCallback(async () => {
    if (!attemptId || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await submitMutation.mutateAsync(attemptId)
      reset()
      toast.success(`Test submitted! Score: ${result.final_score} / ${result.raw_score}`)
      navigate('/attempts')
    } catch {
      toast.error('Failed to submit test. Please try again.')
    } finally {
      setIsSubmitting(false)
      setSubmitOpen(false)
    }
  }, [attemptId, isSubmitting, submitMutation, reset, navigate])

  // Callback passed to ExamTimer for auto-expire submission
  const handleExpire = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await submitMutation.mutateAsync(attemptId ?? '')
      reset()
      toast.success(`Time's up — test submitted! Score: ${result.final_score}`)
      navigate('/attempts')
    } catch {
      toast.error('Auto-submit failed. Please submit manually.')
    } finally {
      setIsSubmitting(false)
    }
  }, [attemptId, isSubmitting, submitMutation, reset, navigate])

  // Loading state — also wait until the store is synced to THIS attempt, so the
  // timer never mounts against an empty/stale session (which would auto-submit).
  if (isLoading || (data && storeAttemptId !== attemptId)) {
    return <ExamPageSkeleton />
  }

  // Error state
  if (isError || (!isLoading && !data)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load exam session. The attempt may not exist or you may not have
            permission to access it.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/attempts">Back to attempts</Link>
        </Button>
      </div>
    )
  }

  // Progress percentage for the header bar
  const progressValue =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Slim top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 shadow-sm">
        <span className="truncate text-sm font-semibold" title={testPaper?.title}>
          {testPaper?.title ?? 'Exam'}
        </span>

        {/* Answered progress bar */}
        <div className="hidden w-32 items-center gap-1.5 sm:flex">
          <Progress
            value={progressValue}
            className="h-1.5"
            aria-label={`${answeredCount} of ${questions.length} answered`}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {answeredCount}/{questions.length}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Timer — owns its own timeElapsedSeconds subscription */}
          {attemptId && (
            <ExamTimer attemptId={attemptId} onExpire={handleExpire} />
          )}

          {/* Full-screen toggle */}
          {document.fullscreenEnabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Submit button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setSubmitOpen(true)}
            aria-haspopup="dialog"
            disabled={isSubmitting}
          >
            Submit Test
          </Button>
        </div>
      </header>

      {/* Main two-column layout */}
      <main
        role="main"
        aria-label={`Exam: ${testPaper?.title ?? ''}`}
        className="flex flex-1 overflow-hidden"
      >
        {/* Question area */}
        <section className="flex-1 overflow-y-auto">
          {attemptId && <QuestionDisplay attemptId={attemptId} />}
        </section>

        {/* Palette — hidden on mobile (stacks below on small screens) */}
        <aside className="hidden w-72 shrink-0 overflow-hidden border-l md:flex md:flex-col">
          <Separator orientation="vertical" className="sr-only" decorative />
          <QuestionPalette />
        </aside>
      </main>

      {/* Mobile palette — visible only on small screens, below question */}
      <div className="border-t md:hidden">
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center justify-between p-3 text-sm font-medium">
            <span>Question Palette</span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              {answeredCount}/{questions.length} answered
            </span>
          </summary>
          <div className="max-h-52 overflow-hidden">
            <QuestionPalette />
          </div>
        </details>
      </div>

      {/* Submit confirmation dialog */}
      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit exam?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              You have answered <strong>{answeredCount}</strong> of{' '}
              <strong>{questions.length}</strong> questions.
              {unansweredCount > 0 && (
                <>
                  {' '}
                  <span className="block text-amber-600">
                    {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} left
                    unanswered — these will receive zero marks.
                  </span>
                </>
              )}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Continue exam</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmSubmit()
              }}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? 'Submitting…' : 'Submit now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
