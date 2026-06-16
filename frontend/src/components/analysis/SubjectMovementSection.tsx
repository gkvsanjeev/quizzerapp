import { useMemo } from 'react'

import { useSubjectMovement } from '@/hooks/useAnalysis'
import type { SubjectMovement as SubjectMovementData, TimeInSubject } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBJECT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  return `${s}s`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Timeline Component
// ---------------------------------------------------------------------------

interface TimelineProps {
  data: SubjectMovementData
  totalDuration: number
}

function Timeline({ data, totalDuration }: TimelineProps) {
  const { transitions, time_in_subject } = data

  // Build timeline segments from transitions
  const timelineSegments = useMemo(() => {
    const segments: Array<{
      subject: string
      startTime: number
      endTime: number
      color: string
    }> = []

    // Assign colors to subjects
    const subjectColorMap = new Map<string, string>()
    const usedColors = new Set<string>()

    const getSubjectColor = (subject: string) => {
      if (subjectColorMap.has(subject)) {
        return subjectColorMap.get(subject)!
      }
      // Find unused color
      for (const color of SUBJECT_COLORS) {
        if (!usedColors.has(color)) {
          subjectColorMap.set(subject, color)
          usedColors.add(color)
          return color
        }
      }
      // Fallback to rotating colors
      const fallback = SUBJECT_COLORS[subjectColorMap.size % SUBJECT_COLORS.length]
      subjectColorMap.set(subject, fallback)
      return fallback
    }

    if (transitions.length === 0 && time_in_subject.length > 0) {
      // No transitions means all time spent in one subject
      const subject = time_in_subject[0].subject
      segments.push({
        subject,
        startTime: 0,
        endTime: totalDuration,
        color: getSubjectColor(subject),
      })
    } else {
      // Build segments from transitions
      let currentSubject = transitions[0]?.from_subject || time_in_subject[0]?.subject || 'Unknown'
      let currentStart = 0

      transitions.forEach((transition, index) => {
        segments.push({
          subject: currentSubject,
          startTime: currentStart,
          endTime: transition.at_time_seconds,
          color: getSubjectColor(currentSubject),
        })
        currentSubject = transition.to_subject
        currentStart = transition.at_time_seconds
      })

      // Add final segment to end of exam
      if (currentStart < totalDuration) {
        segments.push({
          subject: currentSubject,
          startTime: currentStart,
          endTime: totalDuration,
          color: getSubjectColor(currentSubject),
        })
      }
    }

    return segments
  }, [transitions, time_in_subject, totalDuration])

  if (timelineSegments.length === 0) {
    return (
      <p className="text-muted-foreground">No subject movement data available.</p>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Subject Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Horizontal timeline */}
        <div className="relative mb-6 mt-2">
          <div className="flex h-12 w-full overflow-hidden rounded-lg bg-muted">
            {timelineSegments.map((segment, index) => {
              const widthPercent = totalDuration > 0
                ? ((segment.endTime - segment.startTime) / totalDuration) * 100
                : 0

              return (
                <div
                  key={index}
                  className="flex items-center justify-center border-r border-white/20 px-1 text-xs font-medium text-white transition-all hover:brightness-110"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: segment.color,
                    minWidth: widthPercent > 5 ? 'auto' : '0',
                  }}
                  title={`${segment.subject}: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`}
                >
                  {widthPercent > 8 && (
                    <span className="truncate">{segment.subject}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Time labels */}
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0:00</span>
            <span>{formatTime(Math.floor(totalDuration / 2))}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {timelineSegments.map((segment, index) => {
            const duration = segment.endTime - segment.startTime
            const uniqueKey = `${segment.subject}-${index}`
            return (
              <div
                key={uniqueKey}
                className="flex items-center gap-2"
              >
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm">
                  {segment.subject} ({formatDuration(duration)})
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Time in Subject Table
// ---------------------------------------------------------------------------

interface TimeInSubjectTableProps {
  data: TimeInSubject[]
}

function TimeInSubjectTable({ data }: TimeInSubjectTableProps) {
  const totalTime = data.reduce((sum, s) => sum + s.total_seconds, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Time per Subject</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-right font-medium">Total Time</th>
                <th className="px-4 py-3 text-right font-medium">% of Exam</th>
                <th className="px-4 py-3 text-right font-medium">Visits</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((subject) => {
                const percentage = totalTime > 0
                  ? ((subject.total_seconds / totalTime) * 100).toFixed(1)
                  : '0'

                return (
                  <tr key={subject.subject} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{subject.subject}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatDuration(subject.total_seconds)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {percentage}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {subject.visit_count}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SubjectMovementSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading subject movement data">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data renderer
// ---------------------------------------------------------------------------

interface SubjectMovementDataProps {
  data: SubjectMovementData
  totalDuration: number
}

function SubjectMovementData({ data, totalDuration }: SubjectMovementDataProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Timeline data={data} totalDuration={totalDuration} />
        <TimeInSubjectTable data={data.time_in_subject} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface SubjectMovementSectionProps {
  attemptId: string | undefined
}

export function SubjectMovementSection({ attemptId }: SubjectMovementSectionProps) {
  const { data, isLoading, isError } = useSubjectMovement(attemptId)

  if (isLoading) {
    return <SubjectMovementSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load subject movement data. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || (data.transitions.length === 0 && data.time_in_subject.length === 0)) {
    return (
      <Alert className="max-w-xl">
        <AlertDescription>
          No subject movement data available for this attempt.
        </AlertDescription>
      </Alert>
    )
  }

  // Get total duration from overview data - for now use a default or from time_in_subject
  // We'll estimate from the last transition or sum of time_in_subject
  const totalDuration = data.time_in_subject.reduce(
    (sum, s) => sum + s.total_seconds,
    data.transitions[data.transitions.length - 1]?.at_time_seconds || 0
  )

  return <SubjectMovementData data={data} totalDuration={totalDuration} />
}