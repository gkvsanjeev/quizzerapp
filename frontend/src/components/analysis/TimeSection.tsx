import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

import { useTimeAnalysis } from '@/hooks/useAnalysis'
import type { TimeAnalysis as TimeAnalysisData, SubjectTime } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const TIME_BUCKETS = [
  { label: '0-30s', min: 0, max: 30 },
  { label: '30-60s', min: 30, max: 60 },
  { label: '1-2m', min: 60, max: 120 },
  { label: '2-5m', min: 120, max: 300 },
  { label: '5m+', min: 300, max: Infinity },
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

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

interface TimeStatsProps {
  total: number
  avgPerQuestion: number
  difficulty: {
    easy: number
    medium: number
    hard: number
  }
}

function TimeStats({ total, avgPerQuestion, difficulty }: TimeStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Time
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">{formatDuration(total)}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Avg per Question
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">
              {formatDuration(avgPerQuestion)}
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Easy
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
              {formatDuration(difficulty.easy)}
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Medium
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {formatDuration(difficulty.medium)}
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Card className="col-span-2 md:col-span-1">
        <CardContent className="p-4">
          <dl>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Hard
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatDuration(difficulty.hard)}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

interface HistogramProps {
  questions: TimeAnalysisData['questions']
}

function TimeHistogram({ questions }: HistogramProps) {
  const histogramData = useMemo(() => {
    const bucketCounts = TIME_BUCKETS.map((b) => ({ name: b.label, count: 0 }))

    for (const q of questions) {
      const bucketIndex = TIME_BUCKETS.findIndex(
        (b) => q.time_seconds >= b.min && q.time_seconds < b.max
      )
      if (bucketIndex >= 0) {
        bucketCounts[bucketIndex].count++
      }
    }

    return bucketCounts
  }, [questions])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Time Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                formatter={(value: number) => [`${value} questions`, 'Count']}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Questions"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface SubjectTimeChartProps {
  subjects: SubjectTime[]
}

function SubjectTimeChart({ subjects }: SubjectTimeChartProps) {
  const pieData = useMemo(
    () =>
      subjects.map((s) => ({
        name: s.name,
        value: s.time_seconds,
        formatted: formatDuration(s.time_seconds),
      })),
    [subjects]
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Time by Subject</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props) => [
                  props.payload.formatted,
                  name,
                ]}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TimeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading time data">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data renderer
// ---------------------------------------------------------------------------

interface TimeDataProps {
  data: TimeAnalysisData
}

function TimeData({ data }: TimeDataProps) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <TimeStats
        total={data.total_time_seconds}
        avgPerQuestion={data.avg_time_per_question_seconds}
        difficulty={data.difficulty}
      />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <TimeHistogram questions={data.questions} />
        <SubjectTimeChart subjects={data.subjects} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface TimeSectionProps {
  attemptId: string | undefined
}

export function TimeSection({ attemptId }: TimeSectionProps) {
  const { data, isLoading, isError } = useTimeAnalysis(attemptId)

  if (isLoading) {
    return <TimeSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load time analysis. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <Alert className="max-w-xl">
        <AlertDescription>No time data available for this attempt.</AlertDescription>
      </Alert>
    )
  }

  return <TimeData data={data} />
}