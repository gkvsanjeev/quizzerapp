import { useMemo } from 'react'

import { useQuestionJourney } from '@/hooks/useAnalysis'
import type { QuestionJourney as QuestionJourneyData, JourneyEntry, JourneyEventType } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<JourneyEventType, { label: string; color: string; icon: string }> = {
  visited: { label: 'Visited', color: '#6b7280', icon: '👁' },
  answered: { label: 'Answered', color: '#22c55e', icon: '✓' },
  marked_for_review: { label: 'Marked for Review', color: '#f59e0b', icon: '⭐' },
  revisited: { label: 'Revisited', color: '#3b82f6', icon: '↩' },
  answer_changed: { label: 'Answer Changed', color: '#8b5cf6', icon: '✏' },
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Event Badge Component
// ---------------------------------------------------------------------------

interface EventBadgeProps {
  event: JourneyEventType
  timestamp: number
}

function EventBadge({ event, timestamp }: EventBadgeProps) {
  const config = EVENT_CONFIG[event]

  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium"
      style={{
        borderColor: config.color,
        backgroundColor: `${config.color}10`,
        color: config.color,
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      <span className="text-muted-foreground">@ {formatTime(timestamp)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Question Timeline Component
// ---------------------------------------------------------------------------

interface QuestionTimelineProps {
  questionEvents: JourneyEntry[]
}

function QuestionTimeline({ questionEvents }: QuestionTimelineProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {questionEvents.map((entry, index) => (
        <EventBadge key={index} event={entry.event} timestamp={entry.timestamp_seconds} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Question Card Component
// ---------------------------------------------------------------------------

interface QuestionCardProps {
  questionNumber: number
  events: JourneyEntry[]
}

function QuestionCard({ questionNumber, events }: QuestionCardProps) {
  // Get the final state for this question
  const lastEvent = events[events.length - 1]
  const firstEvent = events[0]

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold">Q{questionNumber}</h4>
          <span className="text-xs text-muted-foreground">
            Started @ {formatTime(firstEvent.timestamp_seconds)}
          </span>
        </div>
        <QuestionTimeline questionEvents={events} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Timeline Component
// ---------------------------------------------------------------------------

interface TimelineProps {
  data: QuestionJourneyData
}

function Timeline({ data }: TimelineProps) {
  // Group events by question_number
  const groupedEvents = useMemo(() => {
    const groups = new Map<number, JourneyEntry[]>()

    for (const event of data.events) {
      const existing = groups.get(event.question_number) || []
      groups.set(event.question_number, [...existing, event])
    }

    // Sort by question number
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
  }, [data.events])

  if (groupedEvents.length === 0) {
    return (
      <p className="text-muted-foreground">No question journey data available.</p>
    )
  }

  return (
    <div className="space-y-2">
      {groupedEvents.map(([questionNumber, events]) => (
        <QuestionCard key={questionNumber} questionNumber={questionNumber} events={events} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function QuestionJourneySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading question journey data">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data renderer
// ---------------------------------------------------------------------------

interface QuestionJourneyDataProps {
  data: QuestionJourneyData
}

function QuestionJourneyData({ data }: QuestionJourneyDataProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Question Journey</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline data={data} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface QuestionJourneySectionProps {
  attemptId: string | undefined
}

export function QuestionJourneySection({ attemptId }: QuestionJourneySectionProps) {
  const { data, isLoading, isError } = useQuestionJourney(attemptId)

  if (isLoading) {
    return <QuestionJourneySkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load question journey data. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.events.length === 0) {
    return (
      <Alert className="max-w-xl">
        <AlertDescription>
          No question journey data available for this attempt.
        </AlertDescription>
      </Alert>
    )
  }

  return <QuestionJourneyData data={data} />
}