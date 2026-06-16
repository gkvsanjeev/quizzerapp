import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

import { useDifficultyBreakdown } from '@/hooks/useAnalysis'
import type { DifficultyBreakdown, DifficultyBucket } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  correct: '#22c55e',
  incorrect: '#ef4444',
  unattempted: '#9ca3af',
} as const

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function accuracyVariant(accuracy: number): 'default' | 'secondary' | 'destructive' {
  if (accuracy >= 70) return 'default'
  if (accuracy >= 40) return 'secondary'
  return 'destructive'
}

// ---------------------------------------------------------------------------
// Stacked Bar Chart Component
// ---------------------------------------------------------------------------

interface DifficultyChartProps {
  data: DifficultyBucket[]
  difficultyNames: string[]
}

function DifficultyChart({ data, difficultyNames }: DifficultyChartProps) {
  // Transform data for stacked bar chart
  const chartData = data.map((d, i) => ({
    name: difficultyNames[i],
    correct: d.correct,
    incorrect: d.incorrect,
    unattempted: d.unattempted,
    accuracy: d.accuracy,
    total: d.total,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Difficulty Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Bar dataKey="correct" stackId="a" fill={COLORS.correct} name="Correct" radius={[0, 0, 0, 0]} />
              <Bar dataKey="incorrect" stackId="a" fill={COLORS.incorrect} name="Incorrect" radius={[0, 0, 0, 0]} />
              <Bar dataKey="unattempted" stackId="a" fill={COLORS.unattempted} name="Unattempted" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-green-500" />
            <span className="text-sm text-muted-foreground">Correct</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-red-500" />
            <span className="text-sm text-muted-foreground">Incorrect</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-gray-400" />
            <span className="text-sm text-muted-foreground">Unattempted</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Accuracy Summary Component
// ---------------------------------------------------------------------------

interface AccuracySummaryProps {
  data: DifficultyBucket[]
  difficultyNames: string[]
}

function AccuracySummary({ data, difficultyNames }: AccuracySummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Accuracy by Difficulty</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((d, i) => (
            <div key={difficultyNames[i]} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium capitalize">{difficultyNames[i]}</span>
                <span className="text-sm text-muted-foreground">
                  ({d.correct + d.incorrect + d.unattempted} questions)
                </span>
              </div>
              <Badge variant={accuracyVariant(d.accuracy)}>
                {d.accuracy}% accuracy
              </Badge>
            </div>
          ))}
        </div>

        {/* Overall accuracy */}
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall Accuracy</span>
            <Badge variant="default">
              {(() => {
                const totalCorrect = data.reduce((sum, d) => sum + d.correct, 0)
                const totalAttempted = data.reduce((sum, d) => sum + d.correct + d.incorrect, 0)
                const overall = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0
                return `${overall.toFixed(1)}%`
              })()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DifficultySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading difficulty data">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data renderer
// ---------------------------------------------------------------------------

interface DifficultyDataProps {
  data: DifficultyBreakdown
}

function DifficultyData({ data }: DifficultyDataProps) {
  const difficultyNames = ['Easy', 'Medium', 'Hard'] as const
  const buckets = [data.easy, data.medium, data.hard]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <DifficultyChart data={buckets} difficultyNames={difficultyNames} />
        <AccuracySummary data={buckets} difficultyNames={difficultyNames} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface DifficultySectionProps {
  attemptId: string | undefined
}

export function DifficultySection({ attemptId }: DifficultySectionProps) {
  const { data, isLoading, isError } = useDifficultyBreakdown(attemptId)

  if (isLoading) {
    return <DifficultySkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load difficulty analysis. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <Alert className="max-w-xl">
        <AlertDescription>
          No difficulty data available for this attempt.
        </AlertDescription>
      </Alert>
    )
  }

  return <DifficultyData data={data} />
}