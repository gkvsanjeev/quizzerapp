import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ClipboardList } from 'lucide-react'

import { TeacherPageShell } from '@/components/teacher/TeacherPageShell'
import { StatusBadge } from '@/components/student/StatusBadge'
import { useAttemptsList } from '@/hooks/useAttempts'
import type { AttemptSummary } from '@/types/attempt'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of skeleton rows shown while data is loading. */
const SKELETON_ROW_COUNT = 5

// ---------------------------------------------------------------------------
// AttemptRowSkeleton — mirrors the real row's cell structure
// ---------------------------------------------------------------------------

function AttemptRowSkeleton() {
  return (
    <TableRow aria-hidden="true">
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-24 rounded-md" />
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a nullable ISO date string into a human-readable date/time.
 * Falls back to the submitted_at date when present (for finished attempts).
 */
function formatAttemptDate(
  startedAt: string,
  submittedAt: string | null,
): string {
  const date = submittedAt ? new Date(submittedAt) : new Date(startedAt)
  return format(date, 'dd MMM yyyy, HH:mm')
}

/**
 * Derive a short human-readable label for a test paper when no title is
 * available on the AttemptSummary. The API currently returns only
 * `test_paper_id`. Show a truncated ID so the cell is still informative
 * without an extra fetch.
 */
function testPaperLabel(testPaperId: string): string {
  return `Test paper …${testPaperId.slice(-8)}`
}

/**
 * Format a nullable numeric value as a fixed-decimal percentage string.
 */
function formatPercentile(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// AttemptRow — single data row
// ---------------------------------------------------------------------------

interface AttemptRowProps {
  attempt: AttemptSummary
}

function AttemptRow({ attempt }: AttemptRowProps) {
  const isInProgress = attempt.status === 'in_progress'
  const dateDisplay = formatAttemptDate(attempt.started_at, attempt.submitted_at)

  return (
    <TableRow>
      {/* Test paper title (falls back to a short id if absent) */}
      <TableCell className="font-medium text-foreground">
        {attempt.test_paper_title || testPaperLabel(attempt.test_paper_id)}
      </TableCell>

      {/* Date */}
      <TableCell className="text-muted-foreground">{dateDisplay}</TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={attempt.status} />
      </TableCell>

      {/* Score */}
      <TableCell className="tabular-nums">
        {attempt.final_score !== null ? attempt.final_score : '—'}
      </TableCell>

      {/* Rank */}
      <TableCell className="tabular-nums">
        {attempt.rank !== null ? attempt.rank : '—'}
      </TableCell>

      {/* Percentile */}
      <TableCell className="tabular-nums">
        {formatPercentile(attempt.percentile)}
      </TableCell>

      {/* Action */}
      <TableCell>
        {isInProgress ? (
          <Button variant="outline" size="sm" asChild>
            <Link
              to={`/exam/${attempt.id}`}
              aria-label={`Resume exam started on ${dateDisplay}`}
            >
              Resume
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link
              to={`/analysis/${attempt.id}`}
              aria-label={`View analysis for attempt on ${dateDisplay}`}
            >
              View Analysis
            </Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// AttemptsPage — default export
// ---------------------------------------------------------------------------

export default function AttemptsPage() {
  const { data, isLoading, isError } = useAttemptsList()

  // Sort most-recent first (guard against un-sorted API responses)
  const attempts: AttemptSummary[] = data
    ? [...data].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      )
    : []

  const hasAttempts = attempts.length > 0

  return (
    <TeacherPageShell
      title="My Attempts"
      description="Your exam history — review past tests and analyse your performance."
    >
      {/* ------------------------------------------------------------------ */}
      {/* Loading state                                                        */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && (
        <div aria-busy="true" aria-label="Loading attempts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Paper</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Percentile</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                <AttemptRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Error state                                                          */}
      {/* ------------------------------------------------------------------ */}
      {isError && !isLoading && (
        <Alert variant="destructive" className="max-w-xl">
          <AlertDescription>
            Failed to load attempt history. Please refresh the page or try
            again later.
          </AlertDescription>
        </Alert>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Empty state                                                          */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && !isError && !hasAttempts && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <ClipboardList
            className="h-10 w-10 text-muted-foreground/50"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">
              You haven't taken any tests yet
            </p>
            <p className="text-sm text-muted-foreground">
              Complete a test to see your history and analytics here.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Data state                                                           */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && !isError && hasAttempts && (
        <div className="rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Test Paper</TableHead>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Score</TableHead>
                <TableHead scope="col">Rank</TableHead>
                <TableHead scope="col">Percentile</TableHead>
                <TableHead scope="col" className="w-36">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </TeacherPageShell>
  )
}
