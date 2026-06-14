import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useExamSessionStore } from '@/store/examSessionStore'
import { useSubmitAttempt } from '@/hooks/useAttempts'

interface ExamTimerProps {
  attemptId: string
  onExpire?: () => void
}

function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  const s = clamped % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function toIsoDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `PT${h}H${m}M${s}S`
}

function humanReadable(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`)
  if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`)
  if (s > 0 || parts.length === 0) parts.push(`${s} second${s !== 1 ? 's' : ''}`)
  return parts.join(' ') + ' remaining'
}

export function ExamTimer({ attemptId, onExpire }: ExamTimerProps) {
  const navigate = useNavigate()

  // Fine-grained selectors — this component is the ONLY one that subscribes to timeElapsedSeconds
  const timeElapsedSeconds = useExamSessionStore((s) => s.timeElapsedSeconds)
  const isPaused = useExamSessionStore((s) => s.isPaused)
  const tick = useExamSessionStore((s) => s.tick)
  const reset = useExamSessionStore((s) => s.reset)
  const durationSeconds = useExamSessionStore((s) => s.testPaper?.durationSeconds ?? 0)

  const submitMutation = useSubmitAttempt()

  // Guards against double-submission
  const hasSubmittedRef = useRef(false)
  // Guard against firing the critical warning more than once
  const criticalAnnouncedRef = useRef(false)
  // Ref to hold the current remaining for the assertive live region update
  const criticalAnnouncerRef = useRef<HTMLDivElement | null>(null)

  // The session is only "ready" once syncFromServer has populated the paper's
  // duration. Until then durationSeconds is 0 — never tick or auto-submit, or
  // the timer would fire expiry against an unloaded session on mount.
  const ready = durationSeconds > 0
  const remaining = Math.max(0, durationSeconds - timeElapsedSeconds)
  const isCritical = ready && remaining < 300  // < 5 minutes
  const isUrgent = ready && remaining < 60     // < 1 minute

  // Announce critical threshold once via assertive live region
  useEffect(() => {
    if (isCritical && !criticalAnnouncedRef.current && criticalAnnouncerRef.current) {
      criticalAnnouncedRef.current = true
      criticalAnnouncerRef.current.textContent = 'Warning: less than 5 minutes remaining'
      // Clear after announcement so it can potentially re-fire if reset
      const clearId = setTimeout(() => {
        if (criticalAnnouncerRef.current) {
          criticalAnnouncerRef.current.textContent = ''
        }
      }, 3000)
      return () => clearTimeout(clearId)
    }
  }, [isCritical])

  // Interval: tick every second unless not ready, paused, or expired
  useEffect(() => {
    if (!ready || remaining <= 0 || isPaused) return

    const id = setInterval(() => {
      tick()
    }, 1000)

    return () => clearInterval(id)
  }, [ready, remaining <= 0, isPaused, tick])

  // Auto-submit when time runs out (never before the session is loaded)
  useEffect(() => {
    if (ready && remaining <= 0 && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true

      if (onExpire) {
        onExpire()
        return
      }

      submitMutation.mutate(attemptId, {
        onSuccess: () => {
          reset()
          toast.success("Time's up — test submitted")
          navigate('/attempts')
        },
        onError: () => {
          toast.error('Auto-submit failed. Please submit manually.')
          // Do NOT reset timer — let user retry via the Submit button
        },
      })
    }
  }, [ready, remaining <= 0])

  return (
    <div className="inline-flex items-center gap-2" role="timer" aria-label="Exam countdown timer">
      {/* Assertive announcer — visually hidden, fires once at < 5 min */}
      <div
        ref={criticalAnnouncerRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      <Clock
        className={isCritical ? 'h-4 w-4 text-red-600' : 'h-4 w-4 text-muted-foreground'}
        aria-hidden="true"
      />

      <time
        dateTime={toIsoDuration(remaining)}
        aria-live="polite"
        aria-label={humanReadable(remaining)}
        className={[
          'font-mono text-sm tabular-nums',
          isCritical ? 'font-bold text-red-600' : 'text-foreground',
          isUrgent ? 'animate-pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {formatSeconds(remaining)}
      </time>
    </div>
  )
}
